"""Sliding-window limiter used for free fixer uploads."""

from app.services.ratelimit import SlidingWindowLimiter


def test_allows_up_to_limit_then_blocks():
    limiter = SlidingWindowLimiter(limit=2, window_seconds=60)
    assert limiter.allow("1.1.1.1", now=100.0) is True
    assert limiter.allow("1.1.1.1", now=101.0) is True
    assert limiter.allow("1.1.1.1", now=102.0) is False


def test_window_expiry_frees_a_slot():
    limiter = SlidingWindowLimiter(limit=1, window_seconds=10)
    assert limiter.allow("ip", now=0.0) is True
    assert limiter.allow("ip", now=5.0) is False
    assert limiter.allow("ip", now=10.0) is True


def test_keys_are_independent():
    limiter = SlidingWindowLimiter(limit=1, window_seconds=60)
    assert limiter.allow("a", now=1.0) is True
    assert limiter.allow("b", now=1.0) is True
    assert limiter.allow("a", now=1.0) is False
