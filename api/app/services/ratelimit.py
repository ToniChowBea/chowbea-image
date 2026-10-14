"""In-process sliding-window rate limiter for free fixer uploads.

A single replica is enough: the API runs one uvicorn process. Keys are client
IPs, never file names.
"""

from __future__ import annotations

import threading
import time
from collections import defaultdict, deque


class SlidingWindowLimiter:
    """Allow at most `limit` events per `window_seconds` for each key."""

    def __init__(self, limit: int, window_seconds: float) -> None:
        self.limit = max(1, int(limit))
        self.window_seconds = max(1.0, float(window_seconds))
        self._hits: dict[str, deque[float]] = defaultdict(deque)
        self._lock = threading.Lock()

    def allow(self, key: str, now: float | None = None) -> bool:
        """Record a hit and return True when it is still inside the cap."""
        ts = time.time() if now is None else now
        with self._lock:
            hits = self._hits[key]
            while hits and ts - hits[0] >= self.window_seconds:
                hits.popleft()
            if len(hits) >= self.limit:
                return False
            hits.append(ts)
            return True
