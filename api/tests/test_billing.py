"""Paywall flag, HMAC tokens, webhook mint, and Checkout claim."""

import hashlib
import hmac
import json
import time

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.core.config import Settings
from app.jobs.registry import JobRegistry
from app.routers import billing as billing_router
from app.routers import images
from app.services.billing import (
    EntitlementError,
    EntitlementStore,
    issue_for_session,
    mint_token,
    parse_token,
    paywall_enabled,
)


class _FakeQueue:
    def __init__(self):
        self.published = []

    async def publish(self, job_id):
        self.published.append(job_id)


def _png_bytes(w=16, h=16) -> bytes:
    import pyvips

    return pyvips.Image.black(w, h).add(80).cast("uchar").write_to_buffer(".png")


def test_paywall_off_without_keys(monkeypatch):
    monkeypatch.delenv("STRIPE_SECRET_KEY", raising=False)
    monkeypatch.delenv("STRIPE_WEBHOOK_SECRET", raising=False)
    monkeypatch.delenv("STRIPE_PRICE_BATCH", raising=False)
    monkeypatch.delenv("STRIPE_PRICE_PASS", raising=False)
    s = Settings()
    assert s.paywall_enabled is False
    monkeypatch.setattr("app.core.config.settings", s)
    monkeypatch.setattr("app.services.billing.settings", s)
    assert paywall_enabled() is False


def test_paywall_on_when_all_stripe_keys_set(monkeypatch):
    monkeypatch.setenv("STRIPE_SECRET_KEY", "sk_test_dummy")
    monkeypatch.setenv("STRIPE_WEBHOOK_SECRET", "whsec_dummy")
    monkeypatch.setenv("STRIPE_PRICE_BATCH", "price_batch")
    monkeypatch.setenv("STRIPE_PRICE_PASS", "price_pass")
    s = Settings()
    assert s.stripe_secret_key == "sk_test_dummy"
    assert s.stripe_price_batch == "price_batch"
    assert s.paywall_enabled is True


def test_mint_and_parse_roundtrip(monkeypatch):
    monkeypatch.setenv("STRIPE_WEBHOOK_SECRET", "whsec_test_secret")
    monkeypatch.setenv("FIX_TOKEN_SECRET", "token-secret")
    s = Settings()
    monkeypatch.setattr("app.services.billing.settings", s)
    token = mint_token("pass")
    kind, jti, exp = parse_token(token)
    assert kind == "pass"
    assert jti
    assert exp > time.time()


def test_tampered_token_rejected(monkeypatch):
    monkeypatch.setenv("FIX_TOKEN_SECRET", "token-secret")
    s = Settings()
    monkeypatch.setattr("app.services.billing.settings", s)
    token = mint_token("batch")
    with pytest.raises(EntitlementError):
        parse_token(token[:-2] + "ff")


def test_one_time_token_consumed_once(monkeypatch, tmp_path):
    monkeypatch.setenv("FIX_TOKEN_SECRET", "token-secret")
    s = Settings()
    monkeypatch.setattr("app.services.billing.settings", s)
    store = EntitlementStore(tmp_path / "e.json")
    token = mint_token("batch")
    store.consume(token)
    with pytest.raises(EntitlementError, match="already been used"):
        store.consume(token)
    store.restore(token)
    store.consume(token)


def test_pass_token_reusable(monkeypatch):
    monkeypatch.setenv("FIX_TOKEN_SECRET", "token-secret")
    s = Settings()
    monkeypatch.setattr("app.services.billing.settings", s)
    store = EntitlementStore()
    token = mint_token("pass")
    store.consume(token)
    store.consume(token)


def test_billing_config_paywall_off():
    app = FastAPI()
    app.include_router(billing_router.router)
    app.state.entitlements = EntitlementStore()
    client = TestClient(app)
    body = client.get("/billing/config").json()
    assert body["paywall"] is False
    assert body["batch_price"] == "£1.99"
    assert body["pass_price"] == "£4.99"


def test_checkout_rejected_when_paywall_off():
    app = FastAPI()
    app.include_router(billing_router.router)
    app.state.entitlements = EntitlementStore()
    client = TestClient(app)
    resp = client.post("/billing/checkout", json={"kind": "batch"})
    assert resp.status_code == 409


def test_webhook_mints_token(monkeypatch):
    secret = "whsec_test"
    monkeypatch.setenv("STRIPE_SECRET_KEY", "sk_test_dummy")
    monkeypatch.setenv("STRIPE_WEBHOOK_SECRET", secret)
    monkeypatch.setenv("STRIPE_PRICE_BATCH", "price_batch")
    monkeypatch.setenv("STRIPE_PRICE_PASS", "price_pass")
    monkeypatch.setenv("FIX_TOKEN_SECRET", "token-secret")
    s = Settings()
    monkeypatch.setattr("app.core.config.settings", s)
    monkeypatch.setattr("app.routers.billing.settings", s)
    monkeypatch.setattr("app.services.billing.settings", s)

    payload_obj = {
        "id": "evt_test",
        "object": "event",
        "type": "checkout.session.completed",
        "data": {
            "object": {
                "id": "cs_test_123",
                "object": "checkout.session",
                "payment_status": "paid",
                "metadata": {"kind": "batch"},
            }
        },
    }
    payload = json.dumps(payload_obj, separators=(",", ":"))
    timestamp = int(time.time())
    signed = f"{timestamp}.{payload}"
    sig = hmac.new(secret.encode(), signed.encode(), hashlib.sha256).hexdigest()
    header = f"t={timestamp},v1={sig}"

    app = FastAPI()
    app.include_router(billing_router.router)
    app.state.entitlements = EntitlementStore()
    client = TestClient(app)
    resp = client.post("/billing/webhook", content=payload, headers={"stripe-signature": header})
    assert resp.status_code == 200
    row = app.state.entitlements.token_for_session("cs_test_123")
    assert row is not None
    assert row["kind"] == "batch"

    claimed = client.post("/billing/claim", json={"session_id": "cs_test_123"})
    assert claimed.status_code == 200
    assert claimed.json()["token"] == row["token"]


def test_webhook_rejects_bad_signature(monkeypatch):
    monkeypatch.setenv("STRIPE_WEBHOOK_SECRET", "whsec_test")
    s = Settings()
    monkeypatch.setattr("app.core.config.settings", s)
    monkeypatch.setattr("app.routers.billing.settings", s)
    app = FastAPI()
    app.include_router(billing_router.router)
    app.state.entitlements = EntitlementStore()
    client = TestClient(app)
    resp = client.post(
        "/billing/webhook",
        content=b"{}",
        headers={"stripe-signature": "t=1,v1=deadbeef"},
    )
    assert resp.status_code == 400


def test_batch_free_when_paywall_off():
    app = FastAPI()
    app.include_router(images.router)
    app.state.registry = JobRegistry()
    app.state.job_queue = _FakeQueue()
    app.state.entitlements = EntitlementStore()
    client = TestClient(app)
    files = [
        ("files", ("a.png", _png_bytes(), "image/png")),
        ("files", ("b.png", _png_bytes(), "image/png")),
    ]
    resp = client.post("/img/fix", files=files, data={"preset": "jpg-1mb", "merge": "false"})
    assert resp.status_code == 202


def test_batch_requires_token_when_paywall_on(monkeypatch):
    monkeypatch.setenv("STRIPE_SECRET_KEY", "sk_test_dummy")
    monkeypatch.setenv("STRIPE_WEBHOOK_SECRET", "whsec_dummy")
    monkeypatch.setenv("STRIPE_PRICE_BATCH", "price_batch")
    monkeypatch.setenv("STRIPE_PRICE_PASS", "price_pass")
    monkeypatch.setenv("FIX_TOKEN_SECRET", "token-secret")
    s = Settings()
    monkeypatch.setattr("app.core.config.settings", s)
    monkeypatch.setattr("app.services.billing.settings", s)
    monkeypatch.setattr("app.routers.images.settings", s)

    app = FastAPI()
    app.include_router(images.router)
    app.state.registry = JobRegistry()
    app.state.job_queue = _FakeQueue()
    app.state.entitlements = EntitlementStore()
    client = TestClient(app)
    files = [
        ("files", ("a.png", _png_bytes(), "image/png")),
        ("files", ("b.png", _png_bytes(), "image/png")),
    ]
    denied = client.post("/img/fix", files=files, data={"preset": "jpg-1mb"})
    assert denied.status_code == 402

    token = mint_token("batch")
    allowed = client.post(
        "/img/fix",
        files=files,
        data={"preset": "jpg-1mb", "token": token},
    )
    assert allowed.status_code == 202
    reused = client.post(
        "/img/fix",
        files=files,
        data={"preset": "jpg-1mb", "token": token},
    )
    assert reused.status_code == 402


def test_single_file_stays_free_with_paywall(monkeypatch):
    monkeypatch.setenv("STRIPE_SECRET_KEY", "sk_test_dummy")
    monkeypatch.setenv("STRIPE_WEBHOOK_SECRET", "whsec_dummy")
    monkeypatch.setenv("STRIPE_PRICE_BATCH", "price_batch")
    monkeypatch.setenv("STRIPE_PRICE_PASS", "price_pass")
    s = Settings()
    monkeypatch.setattr("app.core.config.settings", s)
    monkeypatch.setattr("app.services.billing.settings", s)

    app = FastAPI()
    app.include_router(images.router)
    app.state.registry = JobRegistry()
    app.state.job_queue = _FakeQueue()
    app.state.entitlements = EntitlementStore()
    client = TestClient(app)
    files = {"files": ("a.png", _png_bytes(), "image/png")}
    resp = client.post("/img/fix", files=files, data={"preset": "jpg-1mb"})
    assert resp.status_code == 202


def test_issue_for_session_is_idempotent_via_store(monkeypatch):
    monkeypatch.setenv("FIX_TOKEN_SECRET", "token-secret")
    s = Settings()
    monkeypatch.setattr("app.services.billing.settings", s)
    store = EntitlementStore()
    first = issue_for_session(store, "cs_1", "pass")
    # A second mint would be a new token; claim prefers the stored one.
    row = store.token_for_session("cs_1")
    assert row is not None
    assert row["token"] == first
