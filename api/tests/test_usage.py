"""Fixer usage counting at submit and job-complete time. Failures must not break jobs."""

import asyncio
import io

import pyvips
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.core.config import Settings
from app.jobs.registry import JobRegistry, JobStatus
from app.jobs.stats import CounterStore
from app.jobs.worker import execute_job
from app.routers import images, stats as stats_router
from app.services.billing import EntitlementStore
from app.services.fix import FixError


class _FakeQueue:
    def __init__(self):
        self.published = []

    async def publish(self, job_id):
        self.published.append(job_id)


def _png_bytes(w=16, h=16) -> bytes:
    return pyvips.Image.black(w, h).add(80).cast("uchar").write_to_buffer(".png")


def _fix_client(tmp_path):
    app = FastAPI()
    app.include_router(images.router)
    app.include_router(stats_router.router)
    app.state.registry = JobRegistry()
    app.state.job_queue = _FakeQueue()
    app.state.entitlements = EntitlementStore()
    app.state.counter = CounterStore(tmp_path / "stats.json")
    return TestClient(app), app.state.counter


def test_single_fix_counts_started_not_pack(tmp_path):
    client, counter = _fix_client(tmp_path)
    files = {"files": ("a.png", io.BytesIO(_png_bytes()), "image/png")}
    resp = client.post("/img/fix", files=files, data={"preset": "jpg-100kb"})
    assert resp.status_code == 202
    counts = counter.snapshot()["totals"]["jpg-100kb"]
    assert counts["started"] == 1
    assert counts["packs"] == 0
    assert counts["paywall_would_trigger"] == 0
    assert client.get("/stats").json()["totals"]["jpg-100kb"]["started"] == 1


def test_pack_counts_started_packs_and_paywall_would_trigger(tmp_path):
    client, counter = _fix_client(tmp_path)
    files = [
        ("files", ("a.png", io.BytesIO(_png_bytes()), "image/png")),
        ("files", ("b.png", io.BytesIO(_png_bytes()), "image/png")),
    ]
    resp = client.post("/img/fix", files=files, data={"preset": "ucas-documents"})
    assert resp.status_code == 202
    counts = counter.snapshot()["totals"]["ucas-documents"]
    assert counts["started"] == 1
    assert counts["packs"] == 1
    assert counts["paywall_would_trigger"] == 1


def test_paywall_402_still_counts_would_trigger(tmp_path, monkeypatch):
    monkeypatch.setenv("STRIPE_SECRET_KEY", "sk_test_dummy")
    monkeypatch.setenv("STRIPE_WEBHOOK_SECRET", "whsec_dummy")
    monkeypatch.setenv("STRIPE_PRICE_BATCH", "price_batch")
    monkeypatch.setenv("STRIPE_PRICE_PASS", "price_pass")
    s = Settings()
    monkeypatch.setattr("app.core.config.settings", s)
    monkeypatch.setattr("app.services.billing.settings", s)
    monkeypatch.setattr("app.routers.images.settings", s)

    client, counter = _fix_client(tmp_path)
    files = [
        ("files", ("a.png", io.BytesIO(_png_bytes()), "image/png")),
        ("files", ("b.png", io.BytesIO(_png_bytes()), "image/png")),
    ]
    denied = client.post("/img/fix", files=files, data={"preset": "jpg-1mb"})
    assert denied.status_code == 402
    counts = counter.snapshot()["totals"]["jpg-1mb"]
    assert counts["paywall_would_trigger"] == 1
    assert counts["started"] == 0
    assert counts["packs"] == 0


def test_unknown_preset_is_not_counted(tmp_path):
    client, counter = _fix_client(tmp_path)
    files = {"files": ("a.png", io.BytesIO(_png_bytes()), "image/png")}
    resp = client.post("/img/fix", files=files, data={"preset": "not-a-preset"})
    assert resp.status_code == 400
    assert counter.snapshot()["totals"] == {}


def test_counting_failure_does_not_block_submit(tmp_path):
    class Boom:
        def record(self, *args, **kwargs):
            raise RuntimeError("disk")

    app = FastAPI()
    app.include_router(images.router)
    app.state.registry = JobRegistry()
    app.state.job_queue = _FakeQueue()
    app.state.entitlements = EntitlementStore()
    app.state.counter = Boom()
    client = TestClient(app)
    files = {"files": ("a.png", io.BytesIO(_png_bytes()), "image/png")}
    resp = client.post("/img/fix", files=files, data={"preset": "jpg-100kb"})
    assert resp.status_code == 202


def _fix_record(registry, tmp_path, preset="jpg-100kb"):
    ws = tmp_path / "fix-job"
    ws.mkdir()
    return registry.create(
        tool="fix",
        workspace=ws,
        file_count=1,
        total_bytes=0,
        params={"preset": preset, "exts": [".jpg"], "names": ["a.jpg"]},
    )


def test_execute_fix_counts_passed(tmp_path, monkeypatch):
    store = CounterStore(tmp_path / "stats.json")
    monkeypatch.setattr(
        "app.jobs.worker.run_job",
        lambda record: setattr(record, "report", {"passed": True}),
    )
    registry = JobRegistry()
    rec = _fix_record(registry, tmp_path)
    asyncio.run(execute_job(registry, rec.id, store))
    assert rec.status is JobStatus.done
    assert store.snapshot()["totals"]["jpg-100kb"]["passed"] == 1
    assert store.snapshot()["totals"]["jpg-100kb"]["failed"] == 0
    assert store.count == 1


def test_execute_fix_counts_rule_fail_as_failed(tmp_path, monkeypatch):
    store = CounterStore(tmp_path / "stats.json")
    monkeypatch.setattr(
        "app.jobs.worker.run_job",
        lambda record: setattr(record, "report", {"passed": False}),
    )
    registry = JobRegistry()
    rec = _fix_record(registry, tmp_path)
    asyncio.run(execute_job(registry, rec.id, store))
    assert rec.status is JobStatus.done
    assert store.snapshot()["totals"]["jpg-100kb"]["passed"] == 0
    assert store.snapshot()["totals"]["jpg-100kb"]["failed"] == 1


def test_execute_fix_counts_processing_error_as_failed(tmp_path, monkeypatch):
    store = CounterStore(tmp_path / "stats.json")

    def boom(_record):
        raise FixError("cannot encode")

    monkeypatch.setattr("app.jobs.worker.run_job", boom)
    registry = JobRegistry()
    rec = _fix_record(registry, tmp_path)
    asyncio.run(execute_job(registry, rec.id, store))
    assert rec.status is JobStatus.failed
    assert store.snapshot()["totals"]["jpg-100kb"]["failed"] == 1
    assert store.count == 0


def test_execute_job_survives_counter_exceptions(tmp_path, monkeypatch):
    class Boom:
        def increment(self):
            raise RuntimeError("disk")

        def record(self, *args, **kwargs):
            raise RuntimeError("disk")

    monkeypatch.setattr(
        "app.jobs.worker.run_job",
        lambda record: setattr(record, "report", {"passed": True}),
    )
    registry = JobRegistry()
    rec = _fix_record(registry, tmp_path)
    asyncio.run(execute_job(registry, rec.id, Boom()))
    assert rec.status is JobStatus.done
