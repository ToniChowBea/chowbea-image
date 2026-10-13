"""Stripe Checkout entitlements for batch evidence packs. No user accounts.

A webhook (or a later claim of the Checkout session) mints a signed token:
one-time (`batch`, £1.99) or 24-hour (`pass`, £4.99). The browser stores it
in localStorage. Single-file fixes stay free. Paywall is off when Stripe
keys are missing so local/dev still works.
"""

from __future__ import annotations

import hashlib
import hmac
import json
import logging
import time
import uuid
from pathlib import Path
from typing import Any, Literal

from app.core.config import settings

logger = logging.getLogger(__name__)

Kind = Literal["batch", "pass"]

BATCH_GBP = "1.99"
PASS_GBP = "4.99"
PASS_TTL_SECONDS = 24 * 60 * 60
# Unused one-time tokens expire so a lost localStorage key cannot live forever.
BATCH_TTL_SECONDS = 7 * 24 * 60 * 60


class EntitlementError(Exception):
    """Invalid, expired, or already-used payment token."""


def paywall_enabled() -> bool:
    """Feature flag: payments required for batch only when Stripe is configured."""
    return settings.paywall_enabled


def _secret() -> bytes:
    """HMAC key. Empty when paywall is off (tokens are not issued)."""
    secret = settings.token_signing_secret
    if not secret:
        raise EntitlementError("Payments are not configured.")
    return secret.encode("utf-8")


def mint_token(kind: Kind, *, now: float | None = None) -> str:
    """Return a signed `kind.jti.exp.sig` token. Never logs the token."""
    issued = int(now if now is not None else time.time())
    ttl = PASS_TTL_SECONDS if kind == "pass" else BATCH_TTL_SECONDS
    exp = issued + ttl
    jti = uuid.uuid4().hex
    payload = f"{kind}.{jti}.{exp}"
    sig = hmac.new(_secret(), payload.encode("ascii"), hashlib.sha256).hexdigest()
    return f"{payload}.{sig}"


def parse_token(token: str) -> tuple[Kind, str, int]:
    """Validate HMAC and expiry; return (kind, jti, exp). Does not consume."""
    parts = token.strip().split(".")
    if len(parts) != 4 or parts[0] not in {"batch", "pass"}:
        raise EntitlementError("That payment token is not valid.")
    kind, jti, exp_raw, sig = parts
    payload = f"{kind}.{jti}.{exp_raw}"
    expected = hmac.new(_secret(), payload.encode("ascii"), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, sig):
        raise EntitlementError("That payment token is not valid.")
    try:
        exp = int(exp_raw)
    except ValueError as exc:
        raise EntitlementError("That payment token is not valid.") from exc
    if not jti or time.time() > exp:
        raise EntitlementError("That payment token has expired.")
    return kind, jti, exp  # type: ignore[return-value]


class EntitlementStore:
    """Session→token map plus consumed one-time jtis, persisted under data_dir."""

    def __init__(self, path: Path | None = None) -> None:
        self._path = path
        self._sessions: dict[str, dict[str, Any]] = {}
        self._used: set[str] = set()
        self._load()

    def _load(self) -> None:
        """Read persisted entitlements if the file exists."""
        if self._path is None or not self._path.exists():
            return
        try:
            raw = json.loads(self._path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            logger.warning("Could not read entitlement store")
            return
        sessions = raw.get("sessions") if isinstance(raw, dict) else None
        used = raw.get("used") if isinstance(raw, dict) else None
        if isinstance(sessions, dict):
            self._sessions = {str(k): v for k, v in sessions.items() if isinstance(v, dict)}
        if isinstance(used, list):
            self._used = {str(item) for item in used}

    def _save(self) -> None:
        """Write the store; ignore disk errors so Checkout still succeeds."""
        if self._path is None:
            return
        try:
            self._path.parent.mkdir(parents=True, exist_ok=True)
            payload = {"sessions": self._sessions, "used": sorted(self._used)}
            self._path.write_text(json.dumps(payload), encoding="utf-8")
        except OSError:
            logger.warning("Could not persist entitlement store")

    def remember_session(self, session_id: str, token: str, kind: Kind, exp: int) -> None:
        """Store the token minted for a paid Checkout session."""
        self._sessions[session_id] = {"token": token, "kind": kind, "exp": exp}
        self._save()

    def token_for_session(self, session_id: str) -> dict[str, Any] | None:
        """Return the minted payload for `session_id`, or None."""
        row = self._sessions.get(session_id)
        if row is None:
            return None
        if int(row.get("exp") or 0) < time.time():
            return None
        return row

    def consume(self, token: str) -> tuple[Kind, int]:
        """Verify `token`. One-time batch tokens can only be used once."""
        kind, jti, exp = parse_token(token)
        if kind == "batch":
            if jti in self._used:
                raise EntitlementError("That one-time payment has already been used.")
            self._used.add(jti)
            self._save()
        return kind, exp

    def peek(self, token: str) -> tuple[Kind, int]:
        """Verify without consuming a one-time token."""
        kind, jti, exp = parse_token(token)
        if kind == "batch" and jti in self._used:
            raise EntitlementError("That one-time payment has already been used.")
        return kind, exp

    def restore(self, token: str) -> None:
        """Undo a one-time consume when the job failed to queue."""
        try:
            kind, jti, _exp = parse_token(token)
        except EntitlementError:
            return
        if kind == "batch":
            self._used.discard(jti)
            self._save()


def _store() -> EntitlementStore:
    """Process-wide store; tests replace `app.state.entitlements` instead."""
    return EntitlementStore()


def issue_for_session(store: EntitlementStore, session_id: str, kind: Kind) -> str:
    """Mint a token for a paid session and remember it for the claim endpoint."""
    token = mint_token(kind)
    _kind, _jti, exp = parse_token(token)
    store.remember_session(session_id, token, kind, exp)
    return token


def kind_from_session(session: Any) -> Kind:
    """Read `batch`/`pass` from Checkout metadata (set when the session is created)."""
    metadata: Any
    if isinstance(session, dict):
        metadata = session.get("metadata") or {}
    else:
        metadata = getattr(session, "metadata", None)
        if metadata is None and hasattr(session, "get"):
            metadata = session.get("metadata")
        metadata = metadata or {}
    if not isinstance(metadata, dict):
        try:
            metadata = dict(metadata)
        except (TypeError, ValueError):
            metadata = {}
    kind = metadata.get("kind")
    if kind in {"batch", "pass"}:
        return kind
    raise EntitlementError("That Checkout session has no product kind.")
