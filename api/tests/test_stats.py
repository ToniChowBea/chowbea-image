"""The durable jobs counter and per-preset usage aggregates."""

import errno
import json
import logging
import multiprocessing
import os
import threading
from concurrent.futures import ProcessPoolExecutor, ThreadPoolExecutor
from datetime import date
from pathlib import Path

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.core.config import Settings
from app.jobs.stats import METRICS, CounterStore, data_dir_is_durable, warn_if_counts_not_durable
from app.routers import stats as stats_router


def _record_started_n(path_str: str, n: int) -> None:
    """Child-process helper: add `n` started counts on the shared stats file."""
    store = CounterStore(Path(path_str))
    for _ in range(n):
        store.record("jpg-100kb", started=1)


def _increment_n(path_str: str, n: int) -> None:
    """Child-process helper: bump the lifetime jobs counter `n` times."""
    store = CounterStore(Path(path_str))
    for _ in range(n):
        store.increment()


def test_missing_file_starts_at_zero(tmp_path):
    store = CounterStore(tmp_path / "stats.json")
    assert store.count == 0


def test_increment_persists_across_reload(tmp_path):
    path = tmp_path / "stats.json"
    store = CounterStore(path)
    assert store.increment() == 1
    assert store.increment() == 2
    assert CounterStore(path).count == 2


def test_corrupt_file_starts_at_zero(tmp_path):
    path = tmp_path / "stats.json"
    path.write_text("{not json", encoding="utf-8")
    assert CounterStore(path).count == 0


def test_wrong_shape_starts_at_zero(tmp_path):
    path = tmp_path / "stats.json"
    path.write_text('{"jobs_completed": "many"}', encoding="utf-8")
    assert CounterStore(path).count == 0


def test_data_dir_setting_defaults():
    assert Settings(_env_file=None).data_dir == "./data"


def test_legacy_file_keeps_jobs_completed_when_recording_usage(tmp_path):
    path = tmp_path / "stats.json"
    path.write_text('{"jobs_completed": 4}', encoding="utf-8")
    store = CounterStore(path)
    store.record("ucas-documents", started=1)
    assert store.increment() == 5
    reloaded = CounterStore(path)
    assert reloaded.count == 5
    assert reloaded.snapshot()["totals"]["ucas-documents"]["started"] == 1


def test_record_persists_per_preset_and_day(tmp_path, monkeypatch):
    from app.jobs import stats as stats_mod

    monkeypatch.setattr(stats_mod, "utc_today", lambda: date(2026, 11, 7))
    path = tmp_path / "stats.json"
    store = CounterStore(path)
    store.record("jpg-100kb", started=1, packs=1, paywall_would_trigger=1)
    store.record("jpg-100kb", passed=1)
    store.record("ucas-documents", started=1, failed=1)
    snap = CounterStore(path).snapshot()
    jpg = snap["totals"]["jpg-100kb"]
    assert jpg["started"] == 1
    assert jpg["passed"] == 1
    assert jpg["failed"] == 0
    assert jpg["packs"] == 1
    assert jpg["paywall_would_trigger"] == 1
    assert snap["days"] == [
        {
            "date": "2026-11-07",
            "presets": {
                "jpg-100kb": jpg,
                "ucas-documents": snap["totals"]["ucas-documents"],
            },
        }
    ]


def test_snapshot_hides_days_older_than_30_but_keeps_totals(tmp_path, monkeypatch):
    from app.jobs import stats as stats_mod

    path = tmp_path / "stats.json"
    store = CounterStore(path)
    monkeypatch.setattr(stats_mod, "utc_today", lambda: date(2026, 10, 1))
    store.record("jpg-100kb", started=1)
    monkeypatch.setattr(stats_mod, "utc_today", lambda: date(2026, 11, 7))
    store.record("jpg-100kb", started=1)
    snap = store.snapshot(today=date(2026, 11, 7))
    assert [row["date"] for row in snap["days"]] == ["2026-11-07"]
    assert snap["totals"]["jpg-100kb"]["started"] == 2


def test_invalid_preset_is_not_stored(tmp_path):
    store = CounterStore(tmp_path / "stats.json")
    store.record("secret.pdf", started=1)
    store.record("../etc/passwd", started=1)
    store.record("", started=1)
    assert store.snapshot()["totals"] == {}


def test_record_swallows_write_failure(tmp_path):
    path = tmp_path / "stats.json"
    path.mkdir()
    store = CounterStore(path)
    store.record("jpg-100kb", started=1)


def test_stats_endpoint_empty(tmp_path):
    app = FastAPI()
    app.include_router(stats_router.router)
    app.state.counter = CounterStore(tmp_path / "stats.json")
    body = TestClient(app).get("/stats").json()
    assert body == {"totals": {}, "days": []}


def test_stats_endpoint_shape_with_counts(tmp_path, monkeypatch):
    from app.jobs import stats as stats_mod

    monkeypatch.setattr(stats_mod, "utc_today", lambda: date(2026, 11, 7))
    store = CounterStore(tmp_path / "stats.json")
    store.record("nhs-jobs", started=2, passed=1, failed=1)
    app = FastAPI()
    app.include_router(stats_router.router)
    app.state.counter = store
    response = TestClient(app).get("/stats")
    assert response.status_code == 200
    body = response.json()
    counts = body["totals"]["nhs-jobs"]
    assert set(counts) == set(METRICS)
    assert counts["started"] == 2
    assert counts["passed"] == 1
    assert counts["failed"] == 1
    assert counts["packs"] == 0
    assert counts["paywall_would_trigger"] == 0
    assert body["days"][0]["date"] == "2026-11-07"
    assert "filename" not in response.text
    assert "user-agent" not in response.text.lower()


def test_stats_endpoint_empty_without_counter():
    app = FastAPI()
    app.include_router(stats_router.router)
    app.state.counter = None
    response = TestClient(app).get("/stats")
    assert response.status_code == 200
    assert response.json() == {"totals": {}, "days": []}


def test_lock_oserror_skips_write(tmp_path, monkeypatch, caplog):
    path = tmp_path / "stats.json"
    store = CounterStore(path)
    store.record("jpg-100kb", started=1)
    before = path.read_text(encoding="utf-8")

    def boom(*_args, **_kwargs):
        raise OSError("flock failed")

    monkeypatch.setattr("app.jobs.stats.fcntl.flock", boom)
    with caplog.at_level(logging.WARNING):
        store.record("jpg-100kb", started=1)
        store.increment()
    assert path.read_text(encoding="utf-8") == before
    assert json.loads(before)["totals"]["jpg-100kb"]["started"] == 1
    assert "skipping the stats write" in caplog.text


def test_snapshot_still_reads_when_lock_fails(tmp_path, monkeypatch):
    path = tmp_path / "stats.json"
    store = CounterStore(path)
    store.record("jpg-100kb", started=3)

    def boom(*_args, **_kwargs):
        raise OSError("flock failed")

    monkeypatch.setattr("app.jobs.stats.fcntl.flock", boom)
    snap = store.snapshot()
    assert snap["totals"]["jpg-100kb"]["started"] == 3
    assert "filename" not in json.dumps(snap)
    assert "ip" not in json.dumps(snap).lower()


def test_writes_use_unique_temp_names(tmp_path, monkeypatch):
    path = tmp_path / "stats.json"
    seen: list[str] = []
    real_replace = os.replace

    def spy(src, dst):
        seen.append(Path(src).name)
        return real_replace(src, dst)

    monkeypatch.setattr("app.jobs.stats.os.replace", spy)
    store = CounterStore(path)
    store.record("jpg-100kb", started=1)
    store.record("jpg-100kb", passed=1)
    assert len(seen) == 2
    assert seen[0] != seen[1]
    assert all(name.endswith(".tmp") for name in seen)
    # The old shared sibling was stats.tmp; unique names must not reuse it.
    assert "stats.tmp" not in seen
    leftover = [p for p in path.parent.iterdir() if p.suffix == ".tmp"]
    assert leftover == []


def test_short_os_write_persists_complete_json(tmp_path, monkeypatch):
    """A short os.write must not publish truncated JSON or reset counts."""
    path = tmp_path / "stats.json"
    store = CounterStore(path)
    store.record("jpg-100kb", started=3)
    store.record("ucas-documents", failed=2)
    store.increment()
    real_write = os.write
    write_calls = {"n": 0}

    def short_write(fd, data):
        # Return fewer bytes than requested so a single write cannot finish the payload.
        write_calls["n"] += 1
        chunk = bytes(data)[: min(8, len(data))]
        return real_write(fd, chunk)

    real_replace = os.replace

    def spy_replace(src, dst):
        # Rename is allowed only when the temp sibling is already complete JSON.
        json.loads(Path(src).read_text(encoding="utf-8"))
        return real_replace(src, dst)

    monkeypatch.setattr("app.jobs.stats.os.write", short_write)
    monkeypatch.setattr("app.jobs.stats.os.replace", spy_replace)
    store.record("jpg-100kb", passed=1)

    raw = path.read_text(encoding="utf-8")
    payload = json.loads(raw)
    assert payload["jobs_completed"] == 1
    assert payload["totals"]["jpg-100kb"]["started"] == 3
    assert payload["totals"]["jpg-100kb"]["passed"] == 1
    assert payload["totals"]["ucas-documents"]["failed"] == 2
    reloaded = CounterStore(path)
    assert reloaded.count == 1
    assert reloaded.snapshot()["totals"]["jpg-100kb"]["started"] == 3
    assert reloaded.snapshot()["totals"]["jpg-100kb"]["passed"] == 1
    assert write_calls["n"] > 1
    leftover = [p for p in path.parent.iterdir() if p.suffix == ".tmp"]
    assert leftover == []


def test_eintr_during_os_write_persists_complete_json(tmp_path, monkeypatch):
    """EINTR and short writes together must still leave a complete stats file."""
    path = tmp_path / "stats.json"
    store = CounterStore(path)
    store.record("jpg-100kb", started=4)
    real_write = os.write
    state = {"eintr": False, "calls": 0}

    def write_with_eintr(fd, data):
        state["calls"] += 1
        if not state["eintr"]:
            state["eintr"] = True
            raise InterruptedError
        chunk = bytes(data)[: min(5, len(data))]
        return real_write(fd, chunk)

    monkeypatch.setattr("app.jobs.stats.os.write", write_with_eintr)
    store.record("jpg-100kb", packs=1)

    payload = json.loads(path.read_text(encoding="utf-8"))
    assert payload["totals"]["jpg-100kb"]["started"] == 4
    assert payload["totals"]["jpg-100kb"]["packs"] == 1
    assert state["eintr"] is True
    assert state["calls"] > 1
    assert CounterStore(path).snapshot()["totals"]["jpg-100kb"]["started"] == 4


def test_os_write_eintr_errno_retries_and_keeps_counts(tmp_path, monkeypatch):
    """OSError(EINTR) is retried the same way as InterruptedError."""
    path = tmp_path / "stats.json"
    store = CounterStore(path)
    store.record("nhs-jobs", started=6)
    real_write = os.write
    state = {"eintr": False}

    def write_with_errno(fd, data):
        if not state["eintr"]:
            state["eintr"] = True
            raise OSError(errno.EINTR, "interrupted")
        return real_write(fd, data)

    monkeypatch.setattr("app.jobs.stats.os.write", write_with_errno)
    store.record("nhs-jobs", passed=1)
    snap = CounterStore(path).snapshot()
    assert snap["totals"]["nhs-jobs"]["started"] == 6
    assert snap["totals"]["nhs-jobs"]["passed"] == 1


def test_failed_os_write_does_not_publish_partial_file(tmp_path, monkeypatch):
    """A write error after a short syscall must leave the published file intact."""
    path = tmp_path / "stats.json"
    store = CounterStore(path)
    store.record("jpg-100kb", started=5)
    before = path.read_text(encoding="utf-8")
    real_write = os.write
    state = {"calls": 0}

    def write_then_fail(fd, data):
        state["calls"] += 1
        if state["calls"] == 1:
            return real_write(fd, bytes(data)[:4])
        raise OSError("EIO")

    monkeypatch.setattr("app.jobs.stats.os.write", write_then_fail)
    store.record("jpg-100kb", passed=1)
    assert path.read_text(encoding="utf-8") == before
    assert json.loads(before)["totals"]["jpg-100kb"]["started"] == 5
    leftover = [p for p in path.parent.iterdir() if p.suffix == ".tmp"]
    assert leftover == []


def test_concurrent_threads_do_not_lose_counts(tmp_path):
    store = CounterStore(tmp_path / "stats.json")
    n_threads = 16
    per_thread = 25
    start = threading.Barrier(n_threads)

    def work():
        start.wait()
        for _ in range(per_thread):
            store.record("jpg-100kb", started=1)

    with ThreadPoolExecutor(max_workers=n_threads) as pool:
        futs = [pool.submit(work) for _ in range(n_threads)]
        for fut in futs:
            fut.result()
    assert store.snapshot()["totals"]["jpg-100kb"]["started"] == n_threads * per_thread


def test_concurrent_processes_do_not_lose_counts(tmp_path):
    path = tmp_path / "stats.json"
    CounterStore(path)
    workers = 8
    per_worker = 20
    ctx = multiprocessing.get_context("spawn")
    with ProcessPoolExecutor(max_workers=workers, mp_context=ctx) as pool:
        futs = [
            pool.submit(_record_started_n, str(path), per_worker)
            for _ in range(workers)
        ]
        for fut in futs:
            fut.result()
    store = CounterStore(path)
    assert store.snapshot()["totals"]["jpg-100kb"]["started"] == workers * per_worker
    assert store.increment() == 1
    with ProcessPoolExecutor(max_workers=workers, mp_context=ctx) as pool:
        futs = [pool.submit(_increment_n, str(path), per_worker) for _ in range(workers)]
        for fut in futs:
            fut.result()
    assert CounterStore(path).count == 1 + workers * per_worker


def test_root_filesystem_is_not_durable():
    # `/` is the container disk; counts there reset on redeploy.
    assert data_dir_is_durable(Path("/")) is False


def test_warns_when_data_dir_is_not_durable(tmp_path, monkeypatch, caplog):
    monkeypatch.setattr("app.jobs.stats.data_dir_is_durable", lambda _path: False)
    with caplog.at_level(logging.WARNING):
        warn_if_counts_not_durable(tmp_path / "data")
    assert "CHOWBEA_DATA_DIR" in caplog.text
    assert "stats.json" in caplog.text
    assert "mounted volume" in caplog.text


def test_no_durability_warning_when_data_dir_is_a_volume(tmp_path, monkeypatch, caplog):
    monkeypatch.setattr("app.jobs.stats.data_dir_is_durable", lambda _path: True)
    with caplog.at_level(logging.WARNING):
        warn_if_counts_not_durable(tmp_path / "data")
    assert "mounted volume" not in caplog.text
