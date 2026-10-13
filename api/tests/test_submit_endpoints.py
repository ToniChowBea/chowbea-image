import io

import pyvips
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.jobs.registry import JobRegistry
from app.routers import images


class _FakeQueue:
    def __init__(self): self.published = []
    async def publish(self, job_id): self.published.append(job_id)


class _FailingQueue:
    async def publish(self, job_id):
        raise RuntimeError("boom")


@pytest.fixture
def client():
    app = FastAPI()
    app.include_router(images.router)
    app.state.registry = JobRegistry()
    app.state.job_queue = _FakeQueue()
    return TestClient(app)


def _png_bytes(w=16, h=16) -> bytes:
    return pyvips.Image.black(w, h).add(80).cast("uchar").write_to_buffer(".png")


def _jpeg_bytes(w=16, h=16) -> bytes:
    return pyvips.Image.black(w, h).add(80).cast("uchar").write_to_buffer(".jpg")


def _gif_bytes(w=16, h=16) -> bytes:
    return pyvips.Image.black(w, h).add(80).cast("uchar").write_to_buffer(".gif")


def test_convert_accepts_and_queues(client):
    files = {"files": ("a.png", io.BytesIO(_png_bytes()), "image/png")}
    resp = client.post("/img/convert", files=files, data={"target": "jpeg", "quality": "80"})
    assert resp.status_code == 202
    body = resp.json()
    assert body["job_id"]
    assert client.app.state.job_queue.published == [body["job_id"]]


def test_convert_rejects_bad_target(client):
    files = {"files": ("a.png", io.BytesIO(_png_bytes()), "image/png")}
    resp = client.post("/img/convert", files=files, data={"target": "xyz"})
    assert resp.status_code == 400


def test_rejects_non_image_magic_bytes(client):
    files = {"files": ("a.png", io.BytesIO(b"not-an-image"), "image/png")}
    resp = client.post("/img/convert", files=files, data={"target": "jpeg"})
    assert resp.status_code == 400


def test_crop_rect_requires_single_file(client):
    files = [("files", ("a.png", io.BytesIO(_png_bytes()), "image/png")),
             ("files", ("b.png", io.BytesIO(_png_bytes()), "image/png"))]
    resp = client.post("/img/crop", files=files,
                       data={"mode": "rect", "rect": '{"x":0,"y":0,"width":8,"height":8}'})
    assert resp.status_code == 400


def test_resize_percent_accepts(client):
    files = {"files": ("a.png", io.BytesIO(_png_bytes()), "image/png")}
    resp = client.post("/img/resize", files=files, data={"mode": "percent", "percent": "50"})
    assert resp.status_code == 202


def test_resize_preset_accepts(client):
    files = {"files": ("a.png", io.BytesIO(_png_bytes()), "image/png")}
    resp = client.post("/img/resize", files=files, data={"mode": "preset", "preset": "1920"})
    assert resp.status_code == 202


def test_resize_dimensions_locked_accepts(client):
    files = {"files": ("a.png", io.BytesIO(_png_bytes()), "image/png")}
    resp = client.post("/img/resize", files=files, data={"mode": "dimensions", "width": "100"})
    assert resp.status_code == 202


def test_resize_dimensions_unlocked_one_sided_rejected(client):
    files = {"files": ("a.png", io.BytesIO(_png_bytes()), "image/png")}
    resp = client.post("/img/resize", files=files,
                       data={"mode": "dimensions", "width": "100", "lock_aspect": "false"})
    assert resp.status_code == 400


def test_compress_accepts_and_queues(client):
    files = {"files": ("a.png", io.BytesIO(_png_bytes()), "image/png")}
    resp = client.post("/img/compress", files=files, data={"quality": "50"})
    assert resp.status_code == 202


def test_rotate_accepts(client):
    files = {"files": ("a.png", io.BytesIO(_png_bytes()), "image/png")}
    resp = client.post("/img/rotate", files=files, data={"rotation": "90"})
    assert resp.status_code == 202


def test_rotate_nothing_to_do_rejected(client):
    files = {"files": ("a.png", io.BytesIO(_png_bytes()), "image/png")}
    resp = client.post("/img/rotate", files=files, data={"rotation": "0", "flip": "none"})
    assert resp.status_code == 400


def test_crop_aspect_accepts(client):
    files = {"files": ("a.png", io.BytesIO(_png_bytes()), "image/png")}
    resp = client.post("/img/crop", files=files, data={"mode": "aspect", "aspect": "1:1"})
    assert resp.status_code == 202


def test_crop_aspect_invalid_ratio_rejected(client):
    files = {"files": ("a.png", io.BytesIO(_png_bytes()), "image/png")}
    resp = client.post("/img/crop", files=files, data={"mode": "aspect", "aspect": "3:3:3"})
    assert resp.status_code == 400


def test_upload_over_size_limit_rejected(client, monkeypatch):
    monkeypatch.setattr(images, "_MAX_UPLOAD_BYTES", 10)
    files = {"files": ("a.png", io.BytesIO(_png_bytes()), "image/png")}
    resp = client.post("/img/convert", files=files, data={"target": "jpeg"})
    assert resp.status_code == 413


def test_empty_upload_rejected(client):
    files = {"files": ("a.png", io.BytesIO(b""), "image/png")}
    resp = client.post("/img/convert", files=files, data={"target": "jpeg"})
    assert resp.status_code == 400


def test_too_many_files_rejected(client, monkeypatch):
    monkeypatch.setattr(images.settings, "max_files_per_request", 2)
    files = [("files", (f"{n}.png", io.BytesIO(_png_bytes()), "image/png")) for n in ("a", "b", "c")]
    resp = client.post("/img/convert", files=files, data={"target": "jpeg"})
    assert resp.status_code == 400


def test_publish_failure_returns_503_and_discards_job(client):
    client.app.state.job_queue = _FailingQueue()
    files = {"files": ("a.png", io.BytesIO(_png_bytes()), "image/png")}
    resp = client.post("/img/convert", files=files, data={"target": "jpeg"})
    assert resp.status_code == 503
    assert client.app.state.registry.queue_size() == 0


def test_convert_accepts_real_jpeg(client):
    files = {"files": ("a.jpg", io.BytesIO(_jpeg_bytes()), "image/jpeg")}
    resp = client.post("/img/convert", files=files, data={"target": "png"})
    assert resp.status_code == 202


def test_convert_accepts_real_gif(client):
    files = {"files": ("a.gif", io.BytesIO(_gif_bytes()), "image/gif")}
    resp = client.post("/img/convert", files=files, data={"target": "png"})
    assert resp.status_code == 202


def test_rejects_riff_not_webp(client):
    fake = b"RIFF" + (36).to_bytes(4, "little") + b"WAVE" + b"\x00" * 32
    files = {"files": ("a.webp", io.BytesIO(fake), "image/webp")}
    resp = client.post("/img/convert", files=files, data={"target": "png"})
    assert resp.status_code == 400


def test_fix_batch_and_merge_queued_when_paywall_off(client):
    files = [
        ("files", ("a.png", io.BytesIO(_png_bytes()), "image/png")),
        ("files", ("b.png", io.BytesIO(_png_bytes()), "image/png")),
    ]
    resp = client.post("/img/fix", files=files, data={"preset": "ucas-documents", "merge": "true"})
    assert resp.status_code == 202
    job_id = resp.json()["job_id"]
    record = client.app.state.registry.get(job_id)
    assert record.params["merge"] is True
    assert record.file_count == 2


def test_fix_accepts_and_queues(client):
    files = {"files": ("a.png", io.BytesIO(_png_bytes(32, 40)), "image/png")}
    resp = client.post("/img/fix", files=files, data={"preset": "uk-passport-online"})
    assert resp.status_code == 202
    body = resp.json()
    assert body["job_id"]
    assert client.app.state.job_queue.published == [body["job_id"]]


def test_fix_rejects_unknown_preset(client):
    files = {"files": ("a.png", io.BytesIO(_png_bytes()), "image/png")}
    resp = client.post("/img/fix", files=files, data={"preset": "not-a-preset"})
    assert resp.status_code == 400


def test_fix_accepts_pdf_magic_bytes(client):
    pdf = b"%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n"
    files = {"files": ("doc.pdf", io.BytesIO(pdf), "application/pdf")}
    resp = client.post("/img/fix", files=files, data={"preset": "ucas-documents"})
    assert resp.status_code == 202


def test_convert_still_rejects_pdf(client):
    pdf = b"%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n"
    files = {"files": ("doc.pdf", io.BytesIO(pdf), "application/pdf")}
    resp = client.post("/img/convert", files=files, data={"target": "jpeg"})
    assert resp.status_code == 400


def test_convert_accepts_real_webp(client):
    webp = pyvips.Image.black(16, 16).write_to_buffer(".webp")
    files = {"files": ("a.webp", io.BytesIO(webp), "image/webp")}
    resp = client.post("/img/convert", files=files, data={"target": "png"})
    assert resp.status_code == 202
    body = resp.json()
    assert client.app.state.job_queue.published == [body["job_id"]]
