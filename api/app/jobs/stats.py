"""Durable aggregate counters on the Railway volume (CHOWBEA_DATA_DIR).

The JSON file holds the lifetime jobs-completed count plus per-preset, per-UTC-day
fixer usage. It never stores file contents, filenames, IPs, or user agents.

Writes are locked (fcntl) so the HTTP process and a worker replica can share one
volume, then replaced atomically. A crash mid-write cannot corrupt the file.
Counting failures are swallowed so they cannot break a fix job.
"""

from __future__ import annotations

import fcntl
import json
import logging
import os
import re
from contextlib import contextmanager
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Iterator

logger = logging.getLogger(__name__)

# Public metric names returned by GET /stats and stored on disk.
METRICS = ("started", "passed", "failed", "packs", "paywall_would_trigger")

# Rolling window exposed by GET /stats.
SNAPSHOT_DAYS = 30
# Extra days kept on disk so a clock skew cannot drop the public window.
RETAIN_DAYS = 60

# Portal ids look like "uk-passport-online" or "jpg-100kb". Reject anything else
# so a bad caller cannot persist filenames or free-form personal data.
_PRESET_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
_PRESET_MAX_LEN = 80


def utc_today() -> date:
    """Calendar day in UTC, the grain for daily counters."""
    return datetime.now(timezone.utc).date()


def _empty_metrics() -> dict[str, int]:
    """Zeroed counter set for one preset."""
    return {name: 0 for name in METRICS}


def _valid_preset(preset: str) -> bool:
    """True when `preset` is a safe catalogue-style id."""
    return bool(preset) and len(preset) <= _PRESET_MAX_LEN and _PRESET_RE.fullmatch(preset) is not None


class CounterStore:
    """Loads and persists lifetime jobs-completed plus fixer usage aggregates."""

    def __init__(self, path: Path) -> None:
        self._path = path
        self._count = 0
        # Seed the in-memory lifetime count; usage is always re-read from disk.
        data = self._read()
        self._count = data["jobs_completed"]

    @property
    def count(self) -> int:
        return self._count

    def increment(self) -> int:
        """Bump the lifetime jobs counter and persist; a failed write never fails the job."""
        self._count += 1
        try:
            def bump(data: dict) -> None:
                # Disk may be ahead when a worker replica already wrote.
                data["jobs_completed"] = max(int(data.get("jobs_completed") or 0) + 1, self._count)
                self._count = data["jobs_completed"]

            self._update(bump)
        except OSError:
            logger.warning("Could not persist stats to %s", self._path)
        return self._count

    def record(self, preset: str, **deltas: int) -> None:
        """Add non-negative metric deltas for `preset` on today's UTC date.

        Unknown metric names and invalid preset ids are ignored. Disk errors are
        logged and swallowed so callers never have to try/except.
        """
        if not _valid_preset(preset):
            logger.warning("Usage count skipped for invalid preset id")
            return
        changes = {
            name: int(value)
            for name, value in deltas.items()
            if name in METRICS and isinstance(value, int) and not isinstance(value, bool) and value > 0
        }
        if not changes:
            return
        day = utc_today().isoformat()
        try:
            def apply(data: dict) -> None:
                self._apply_deltas(data, preset, day, changes)
                self._prune_days(data, utc_today())

            self._update(apply)
        except OSError:
            logger.warning("Could not persist usage stats to %s", self._path)
        except Exception:
            logger.warning("Usage count skipped", exc_info=True)

    def snapshot(self, *, days: int = SNAPSHOT_DAYS, today: date | None = None) -> dict:
        """Return totals and the last `days` UTC dates. Aggregates only."""
        today = today or utc_today()
        try:
            data = self._read()
        except Exception:
            logger.warning("Usage snapshot skipped", exc_info=True)
            return {"totals": {}, "days": []}
        cutoff = (today - timedelta(days=max(days, 1) - 1)).isoformat()
        day_rows: list[dict] = []
        for day_key in sorted(data["days"]):
            if day_key < cutoff or day_key > today.isoformat():
                continue
            presets = {
                preset_id: _empty_metrics() | counts
                for preset_id, counts in data["days"][day_key].items()
            }
            if presets:
                day_rows.append({"date": day_key, "presets": presets})
        totals = {
            preset_id: _empty_metrics() | counts
            for preset_id, counts in data["totals"].items()
        }
        return {"totals": totals, "days": day_rows}

    def _apply_deltas(self, data: dict, preset: str, day: str, changes: dict[str, int]) -> None:
        """Add `changes` into both the all-time totals and the given UTC day."""
        totals = data["totals"].setdefault(preset, _empty_metrics())
        for name, value in changes.items():
            totals[name] = int(totals.get(name) or 0) + value
        day_map = data["days"].setdefault(day, {})
        day_bucket = day_map.setdefault(preset, _empty_metrics())
        for name, value in changes.items():
            day_bucket[name] = int(day_bucket.get(name) or 0) + value

    def _prune_days(self, data: dict, today: date) -> None:
        """Drop daily rows older than RETAIN_DAYS; all-time totals stay."""
        cutoff = (today - timedelta(days=RETAIN_DAYS)).isoformat()
        data["days"] = {day: presets for day, presets in data["days"].items() if day >= cutoff}

    @contextmanager
    def _locked(self) -> Iterator[None]:
        """Exclusive lock so API and worker processes do not clobber the file."""
        self._path.parent.mkdir(parents=True, exist_ok=True)
        lock_path = self._path.with_name(self._path.name + ".lock")
        with open(lock_path, "a+", encoding="utf-8") as lock:
            try:
                fcntl.flock(lock.fileno(), fcntl.LOCK_EX)
            except OSError:
                # Still read-modify-write; single-process deploys do not need the lock.
                yield
                return
            try:
                yield
            finally:
                try:
                    fcntl.flock(lock.fileno(), fcntl.LOCK_UN)
                except OSError:
                    pass

    def _update(self, mutator) -> dict:
        """Lock, read, mutate in place, atomically replace."""
        with self._locked():
            data = self._read_unlocked()
            mutator(data)
            self._write_unlocked(data)
            return data

    def _read(self) -> dict:
        """Locked read used by snapshot and startup."""
        try:
            with self._locked():
                return self._read_unlocked()
        except OSError:
            logger.warning("Stats file %s unreadable; starting the counter at 0", self._path)
            return self._blank()

    def _read_unlocked(self) -> dict:
        try:
            payload = json.loads(self._path.read_text(encoding="utf-8"))
            return self._coerce(payload)
        except FileNotFoundError:
            return self._blank()
        except (ValueError, KeyError, TypeError, OSError, json.JSONDecodeError):
            logger.warning("Stats file %s unreadable; starting the counter at 0", self._path)
            return self._blank()

    def _write_unlocked(self, data: dict) -> None:
        tmp = self._path.with_suffix(".tmp")
        tmp.write_text(json.dumps(data, separators=(",", ":")), encoding="utf-8")
        os.replace(tmp, self._path)

    def _coerce(self, payload: object) -> dict:
        """Accept the legacy `{jobs_completed: N}` shape and the usage shape."""
        if not isinstance(payload, dict):
            raise ValueError("stats payload must be an object")
        count = payload["jobs_completed"]
        if isinstance(count, bool) or not isinstance(count, int) or count < 0:
            raise ValueError(f"bad count: {count!r}")
        totals = self._coerce_preset_map(payload.get("totals"))
        days: dict[str, dict[str, dict[str, int]]] = {}
        raw_days = payload.get("days")
        if isinstance(raw_days, dict):
            for day, presets in raw_days.items():
                if not isinstance(day, str) or not _looks_like_day(day):
                    continue
                days[day] = self._coerce_preset_map(presets)
        return {"jobs_completed": count, "totals": totals, "days": days}

    def _coerce_preset_map(self, raw: object) -> dict[str, dict[str, int]]:
        """Keep only safe preset ids and the known integer metrics."""
        if not isinstance(raw, dict):
            return {}
        out: dict[str, dict[str, int]] = {}
        for preset, counts in raw.items():
            if not isinstance(preset, str) or not _valid_preset(preset):
                continue
            if not isinstance(counts, dict):
                continue
            bucket = _empty_metrics()
            for name in METRICS:
                value = counts.get(name, 0)
                if isinstance(value, bool) or not isinstance(value, int) or value < 0:
                    continue
                bucket[name] = value
            out[preset] = bucket
        return out

    def _blank(self) -> dict:
        return {"jobs_completed": 0, "totals": {}, "days": {}}


def _looks_like_day(value: str) -> bool:
    """True for an ISO calendar date used as a JSON key."""
    if len(value) != 10 or value[4] != "-" or value[7] != "-":
        return False
    try:
        date.fromisoformat(value)
    except ValueError:
        return False
    return True


def record_usage(counter: CounterStore | None, preset: str, **deltas: int) -> None:
    """Best-effort usage increment. Never raises, even if `counter` is a test double."""
    if counter is None:
        return
    try:
        counter.record(preset, **deltas)
    except Exception:
        logger.warning("Usage count skipped", exc_info=True)
