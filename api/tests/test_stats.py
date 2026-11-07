"""The durable jobs counter and per-preset usage aggregates."""

from datetime import date

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.core.config import Settings
from app.jobs.stats import METRICS, CounterStore
from app.routers import stats as stats_router


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
