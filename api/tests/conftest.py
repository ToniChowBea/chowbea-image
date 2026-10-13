"""Shared test fixtures. Keep the free-fix limiter from leaking across tests."""

import pytest

from app.routers import images
from app.services.ratelimit import SlidingWindowLimiter


@pytest.fixture(autouse=True)
def _generous_fix_limiter(monkeypatch: pytest.MonkeyPatch) -> None:
    """Give tests a high per-IP cap so suite order cannot trip 429s."""
    monkeypatch.setattr(
        images,
        "_fix_limiter",
        SlidingWindowLimiter(limit=10_000, window_seconds=60),
    )
