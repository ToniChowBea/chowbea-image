"""Stripe Checkout + webhook + token claim. No accounts."""

from __future__ import annotations

import logging
from typing import Any, Literal

import stripe
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from app.core.config import settings
from app.services.billing import (
    BATCH_GBP,
    PASS_GBP,
    EntitlementError,
    EntitlementStore,
    issue_for_session,
    kind_from_session,
    paywall_enabled,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/billing", tags=["billing"])

Kind = Literal["batch", "pass"]


class BillingConfig(BaseModel):
    """What the web app needs to know before showing a paywall."""

    paywall: bool
    batch_price: str
    pass_price: str
    currency: str = "gbp"


class CheckoutRequest(BaseModel):
    """Which one-off product to buy."""

    kind: Kind


class CheckoutResponse(BaseModel):
    """Stripe-hosted Checkout URL to redirect the browser to."""

    url: str


class ClaimRequest(BaseModel):
    """Checkout session id from the success URL query string."""

    session_id: str = Field(min_length=1)


class ClaimResponse(BaseModel):
    """Signed token the browser stores in localStorage."""

    token: str
    kind: Kind
    expires_at: int


class EntitlementResponse(BaseModel):
    """Whether a stored token is still usable."""

    valid: bool
    kind: Kind | None = None
    expires_at: int | None = None
    detail: str | None = None


def _store(request: Request) -> EntitlementStore:
    """Process-wide entitlement store created at startup."""
    store = getattr(request.app.state, "entitlements", None)
    if store is None:
        store = EntitlementStore()
        request.app.state.entitlements = store
    return store


def _stripe() -> None:
    """Point the Stripe SDK at the secret from env (test or live)."""
    stripe.api_key = settings.stripe_secret_key


def _price_id(kind: Kind) -> str:
    """Price id for this product; both come from env, never hardcoded."""
    return settings.stripe_price_batch if kind == "batch" else settings.stripe_price_pass


@router.get("/config", summary="Whether the batch paywall is on", response_model=BillingConfig)
def billing_config() -> BillingConfig:
    """Paywall is off when Stripe keys are missing so local/dev stays free."""
    return BillingConfig(
        paywall=paywall_enabled(),
        batch_price=f"£{BATCH_GBP}",
        pass_price=f"£{PASS_GBP}",
    )


@router.post("/checkout", summary="Start a Stripe Checkout session", response_model=CheckoutResponse)
def create_checkout(body: CheckoutRequest) -> CheckoutResponse:
    """One-off payment; success URL carries `session_id` for the claim step."""
    if not paywall_enabled():
        raise HTTPException(status_code=409, detail="Payments are not configured.")
    _stripe()
    origin = settings.public_web_url.rstrip("/")
    try:
        session = stripe.checkout.Session.create(
            mode="payment",
            line_items=[{"price": _price_id(body.kind), "quantity": 1}],
            success_url=f"{origin}/fix?session_id={{CHECKOUT_SESSION_ID}}",
            cancel_url=f"{origin}/fix?cancelled=1",
            metadata={"kind": body.kind},
            client_reference_id=body.kind,
        )
    except stripe.StripeError:
        logger.exception("Stripe Checkout session failed")
        raise HTTPException(status_code=502, detail="Could not start checkout. Try again.") from None
    if not session.url:
        raise HTTPException(status_code=502, detail="Could not start checkout. Try again.")
    return CheckoutResponse(url=session.url)


@router.post("/webhook", summary="Stripe webhook: mint a token for a paid session")
async def stripe_webhook(request: Request) -> dict[str, str]:
    """Verify the signature, then mint a one-time or 24h token for the session."""
    if not settings.stripe_webhook_secret.strip():
        raise HTTPException(status_code=503, detail="Payments are not configured.")
    payload = await request.body()
    sig = request.headers.get("stripe-signature")
    if not sig:
        raise HTTPException(status_code=400, detail="Missing Stripe signature.")
    try:
        event = stripe.Webhook.construct_event(payload, sig, settings.stripe_webhook_secret)
    except (ValueError, stripe.SignatureVerificationError):
        raise HTTPException(status_code=400, detail="Invalid Stripe signature.") from None
    if event["type"] == "checkout.session.completed":
        session = event["data"]["object"]
        if session.get("payment_status") not in {"paid", "no_payment_required"} and session.get(
            "status"
        ) not in {"complete", None}:
            return {"status": "ignored"}
        try:
            kind = kind_from_session(session)
        except EntitlementError:
            logger.warning("Checkout session completed without a product kind")
            return {"status": "ignored"}
        session_id = str(session.get("id") or "")
        if session_id:
            issue_for_session(_store(request), session_id, kind)
    return {"status": "ok"}


@router.post("/claim", summary="Exchange a Checkout session for a localStorage token", response_model=ClaimResponse)
def claim_session(request: Request, body: ClaimRequest) -> ClaimResponse:
    """Idempotent: webhook or this call mints the token; the browser stores it."""
    if not paywall_enabled():
        raise HTTPException(status_code=409, detail="Payments are not configured.")
    store = _store(request)
    existing = store.token_for_session(body.session_id)
    if existing is not None:
        return ClaimResponse(
            token=str(existing["token"]),
            kind=existing["kind"],
            expires_at=int(existing["exp"]),
        )
    _stripe()
    try:
        session = stripe.checkout.Session.retrieve(body.session_id)
    except stripe.StripeError:
        raise HTTPException(status_code=404, detail="Checkout session not found.") from None
    if session.get("payment_status") != "paid" and session.get("status") != "complete":
        raise HTTPException(status_code=402, detail="Payment has not completed yet.")
    try:
        kind = kind_from_session(session)
    except EntitlementError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    token = issue_for_session(store, body.session_id, kind)
    row = store.token_for_session(body.session_id)
    exp = int(row["exp"]) if row else 0
    return ClaimResponse(token=token, kind=kind, expires_at=exp)


@router.get("/entitlement", summary="Check a stored token", response_model=EntitlementResponse)
def entitlement_status(request: Request, token: str) -> EntitlementResponse:
    """Used by the web app to show '24-hour pass active' vs 'pay to pack'."""
    if not token:
        return EntitlementResponse(valid=False, detail="No token.")
    if not paywall_enabled():
        return EntitlementResponse(valid=True, kind=None, detail="Paywall off.")
    try:
        kind, exp = _store(request).peek(token)
    except EntitlementError as exc:
        return EntitlementResponse(valid=False, detail=str(exc))
    return EntitlementResponse(valid=True, kind=kind, expires_at=exp)
