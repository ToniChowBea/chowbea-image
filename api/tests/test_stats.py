"""The durable jobs counter and per-preset usage aggregates."""

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
