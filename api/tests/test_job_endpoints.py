"""Status polling, result download, and the public queue board (jobs router)."""

import tempfile
from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.jobs.registry import JobRegistry, JobStatus
from app.jobs.stats import CounterStore
from app.routers import jobs


def _make_client(registry, counter=None):
    app = FastAPI()
    app.include_router(jobs.router)
    app.state.registry = registry
    app.state.counter = counter
    return TestClient(app)


def _queue_job(registry, tmp_path, tool="rotate", name="a.png"):
    ws = Path(tempfile.mkdtemp(dir=tmp_path))
    record = registry.create(
        tool=tool, workspace=ws, file_count=1, total_bytes=10, params={"names": [name]}
    )
    return record.id


@pytest.fixture
def registry():
    return JobRegistry()


def test_status_reports_position_and_queue_size(registry, tmp_path):
    client = _make_client(registry)
    first = _queue_job(registry, tmp_path)
    second = _queue_job(registry, tmp_path)
    body = client.get(f"/jobs/{second}").json()
    assert body["status"] == "queued"
    assert body["position"] == 2
    assert body["queue_size"] == 2
    assert body["error"] is None
    assert body["tool"] == "rotate"
    assert first != second


def test_status_unknown_job_is_404(registry):
    client = _make_client(registry)
    assert client.get("/jobs/deadbeef").status_code == 404


def test_download_before_done_is_409(registry, tmp_path):
    client = _make_client(registry)
    job_id = _queue_job(registry, tmp_path)
    assert client.get(f"/jobs/{job_id}/download").status_code == 409


def test_download_after_done_streams_result(registry, tmp_path):
    client = _make_client(registry)
    job_id = _queue_job(registry, tmp_path)
    record = registry.get(job_id)
    result = record.workspace / "output.png"
    result.write_bytes(b"\x89PNG-fake")
    record.status = JobStatus.done
    record.result_path = result
    record.download_name = "rotated-a.png"
    record.media_type = "image/png"
    response = client.get(f"/jobs/{job_id}/download")
    assert response.status_code == 200
    assert response.content == b"\x89PNG-fake"
    assert "rotated-a.png" in response.headers["content-disposition"]


def test_queue_board_is_anonymized(registry, tmp_path):
    client = _make_client(registry)
    job_id = _queue_job(registry, tmp_path, name="secret-salary-data.png")
    registry.get(job_id).status = JobStatus.processing
    waiting_id = _queue_job(registry, tmp_path)
    response = client.get("/queue")
    board = response.json()
    assert board["concurrency"] == 3
    assert [e["id_prefix"] for e in board["processing"]] == [job_id[:6]]
    assert [e["id_prefix"] for e in board["waiting"]] == [waiting_id[:6]]
    assert "secret-salary-data.png" not in response.text


def test_queue_board_reports_jobs_completed(registry, tmp_path):
    counter = CounterStore(tmp_path / "stats.json")
    counter.increment()
    counter.increment()
    client = _make_client(registry, counter=counter)
    board = client.get("/queue").json()
    assert board["jobs_completed"] == 2
