"""Abuse controls: per-IP free-fix rate limit, pack caps, clear PDF errors."""

import io

import pyvips
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from pypdf import PdfWriter

from app.jobs.registry import JobRegistry
from app.routers import images
from app.services.fix import FixError, fix_files
from app.services.presets import get_preset
from app.services.ratelimit import SlidingWindowLimiter


class _FakeQueue:
    def __init__(self):
        self.published = []

    async def publish(self, job_id):
        self.published.append(job_id)


@pytest.fixture
def client():
    app = FastAPI()
    app.include_router(images.router)
    app.state.registry = JobRegistry()
    app.state.job_queue = _FakeQueue()
    return TestClient(app)


def _png_bytes(w=16, h=16) -> bytes:
    return pyvips.Image.black(w, h).add(80).cast("uchar").write_to_buffer(".png")


def test_free_fix_rate_limited_per_ip(client, monkeypatch):
    monkeypatch.setattr(images, "_fix_limiter", SlidingWindowLimiter(limit=1, window_seconds=60))
    files = {"files": ("a.png", io.BytesIO(_png_bytes()), "image/png")}
    first = client.post("/img/fix", files=files, data={"preset": "jpg-1mb"})
    assert first.status_code == 202
    files = {"files": ("b.png", io.BytesIO(_png_bytes()), "image/png")}
    second = client.post("/img/fix", files=files, data={"preset": "jpg-1mb"})
    assert second.status_code == 429
    assert "free fixes" in second.json()["detail"]


def test_fix_pack_file_count_capped(client, monkeypatch):
    monkeypatch.setattr(images.settings, "fix_max_files", 1)
    files = [
        ("files", ("a.png", io.BytesIO(_png_bytes()), "image/png")),
        ("files", ("b.png", io.BytesIO(_png_bytes()), "image/png")),
    ]
    resp = client.post("/img/fix", files=files, data={"preset": "ucas-documents"})
    assert resp.status_code == 400
    assert "Too many files" in resp.json()["detail"]


def test_fix_pack_file_size_capped(client, monkeypatch):
    monkeypatch.setattr(images, "_max_upload_bytes", lambda *, for_fix: 10)
    files = {"files": ("a.png", io.BytesIO(_png_bytes()), "image/png")}
    resp = client.post("/img/fix", files=files, data={"preset": "jpg-1mb"})
    assert resp.status_code == 413


def test_unsupported_type_message_is_generic(client):
    files = {"files": ("notes.txt", io.BytesIO(b"hello world"), "text/plain")}
    resp = client.post("/img/fix", files=files, data={"preset": "ucas-documents"})
    assert resp.status_code == 400
    assert "not supported" in resp.json()["detail"].lower()


def test_fix_corrupt_pdf_message(tmp_path):
    src = tmp_path / "broken.pdf"
    src.write_bytes(b"%PDF-1.4\nnot actually a pdf xref")
    preset = get_preset("ucas-documents")
    assert preset is not None
    with pytest.raises(FixError, match="corrupt"):
        fix_files([src], ["broken.pdf"], tmp_path, preset)


def test_fix_encrypted_pdf_message(tmp_path):
    locked = tmp_path / "locked.pdf"
    writer = PdfWriter()
    writer.add_blank_page(width=72, height=72)
    writer.encrypt("secret")
    writer.write(str(locked))
    preset = get_preset("ucas-documents")
    assert preset is not None
    with pytest.raises(FixError, match="password"):
        fix_files([locked], ["locked.pdf"], tmp_path, preset)
