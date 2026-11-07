"""Public read-only usage aggregates. Safe to expose: counts only, no personal data."""

from __future__ import annotations

import logging

from fastapi import APIRouter, Request

from app.jobs.schemas import UsageStats
from app.jobs.stats import SNAPSHOT_DAYS

logger = logging.getLogger(__name__)

router = APIRouter(tags=["meta"])


@router.get("/stats", summary="Fixer usage aggregates", response_model=UsageStats)
def usage_stats(request: Request) -> UsageStats:
    """Return per-preset totals and the last 30 UTC days.

    Empty when the data directory is unwritable. Failures return zeros so this
    endpoint cannot 500 because a counter file is missing or corrupt.
    """
    counter = getattr(request.app.state, "counter", None)
    if counter is None:
        return UsageStats(totals={}, days=[])
    try:
        return UsageStats.model_validate(counter.snapshot(days=SNAPSHOT_DAYS))
    except Exception:
        logger.warning("Usage snapshot skipped", exc_info=True)
        return UsageStats(totals={}, days=[])
