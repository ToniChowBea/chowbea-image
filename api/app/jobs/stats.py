"""Durable aggregate counters on the Railway volume (CHOWBEA_DATA_DIR).

The JSON file holds the lifetime jobs-completed count plus per-preset, per-UTC-day
fixer usage. It never stores file contents, filenames, IPs, or user agents.

Writes are locked (fcntl) so the HTTP process and a worker replica can share one
volume, then replaced atomically. A crash mid-write cannot corrupt the file.
Counting failures are swallowed so they cannot break a fix job.
"""

from __future__ import annotations

import errno
import fcntl
import json
import logging
import os
import re
import tempfile
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


def data_dir_is_durable(path: Path) -> bool:
    """True when `path` sits on a mount other than the container root filesystem.

    Compose and Railway keep `$CHOWBEA_DATA_DIR` across redeploys by mounting a
    volume there (typically `/data`). A directory whose only mount is `/` lives
    on the container disk and is wiped when the container is replaced.
    """
    try:
        resolved = path.expanduser().resolve()
    except OSError:
        return False
    root = Path("/")
    current = resolved
    # Walk up until we find a mount; `/` itself is the ephemeral container disk.
    while True:
        try:
            if current.is_mount():
                return current != root
        except OSError:
            return False
        parent = current.parent
        if parent == current:
            return False
        current = parent


def warn_if_counts_not_durable(data_dir: Path) -> None:
    """Log when usage counts will reset on the next container redeploy."""
    if data_dir_is_durable(data_dir):
        return
    logger.warning(
        "Usage counts at %s/stats.json are not on a mounted volume and will "
        "reset on container redeploy. Set CHOWBEA_DATA_DIR to a volume mount "
        "(production: /data) so the file survives. Counting still runs.",
        data_dir,
    )


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
        """Hold an exclusive flock for the whole read-modify-write.

        If the lock cannot be acquired, raise OSError and do not yield, so the
        caller never writes without the lock. Counting is best-effort; callers
        log and swallow that error.
        """
        self._path.parent.mkdir(parents=True, exist_ok=True)
        lock_path = self._path.with_name(self._path.name + ".lock")
        with open(lock_path, "a+", encoding="utf-8") as lock:
            try:
                fcntl.flock(lock.fileno(), fcntl.LOCK_EX)
            except OSError:
                logger.warning("Could not lock %s; skipping the stats write", lock_path)
                raise
            try:
                yield
            finally:
                try:
                    fcntl.flock(lock.fileno(), fcntl.LOCK_UN)
                except OSError:
                    pass

    def _update(self, mutator) -> dict:
        """Lock, read, mutate in place, atomically replace. Requires the lock."""
        with self._locked():
            data = self._read_unlocked()
            mutator(data)
            self._write_unlocked(data)
            return data

    def _read(self) -> dict:
        """Read without the exclusive lock so GET /stats cannot stall writers.

        os.replace makes the published file appear atomically, so a reader sees
        either the previous complete JSON or the new one. An unreadable file
        becomes a blank snapshot instead of raising.
        """
        try:
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
        """Replace the stats file via a unique temp sibling, then os.replace.

        Unique names mean concurrent writers cannot share a `.tmp` path even if
        a lock is missing. Callers must hold `_locked` so the read-modify-write
        itself cannot lose updates.

        The temp file is fully written and fsync'd before rename. A short
        `os.write` therefore cannot publish truncated JSON (which `_read_unlocked`
        would treat as corrupt and reset to blank counts).
        """
        # Compact JSON keeps the on-disk file small; encode once for the write loop.
        payload = json.dumps(data, separators=(",", ":")).encode("utf-8")
        fd, tmp_name = tempfile.mkstemp(
            prefix=f".{self._path.name}.",
            suffix=".tmp",
            dir=self._path.parent,
        )
        try:
            try:
                _write_fully(fd, payload)
                _fsync(fd)
            finally:
                os.close(fd)
            # Rename only after a complete, durable temp file exists.
            os.replace(tmp_name, self._path)
        except Exception:
            # Leave the published file untouched if anything failed mid-write.
            try:
                os.unlink(tmp_name)
            except OSError:
                pass
            raise

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


def _write_fully(fd: int, payload: bytes) -> None:
    """Write every byte of `payload` to `fd`.

    `os.write` may return a short count or raise EINTR. Loop until the whole
    payload is on disk so a later rename cannot publish truncated JSON.
    """
    remaining = memoryview(payload)
    while remaining:
        try:
            # One syscall may write only a prefix of `remaining`.
            written = os.write(fd, remaining)
        except OSError as exc:
            # Retry the same slice when the syscall is interrupted.
            if isinstance(exc, InterruptedError) or exc.errno == errno.EINTR:
                continue
            raise
        if written < 1:
            raise OSError("os.write wrote 0 bytes before the payload was complete")
        remaining = remaining[written:]


def _fsync(fd: int) -> None:
    """Flush `fd` to stable storage, retrying if the syscall is interrupted."""
    while True:
        try:
            os.fsync(fd)
            return
        except OSError as exc:
            if isinstance(exc, InterruptedError) or exc.errno == errno.EINTR:
                continue
            raise


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
