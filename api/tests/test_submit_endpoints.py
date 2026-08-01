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


@pytest.fixture
def client():
    app = FastAPI()
    app.include_router(images.router)
    app.state.registry = JobRegistry()
    app.state.job_queue = _FakeQueue()
    return TestClient(app)


def _png_bytes(w=16, h=16) -> bytes:
    return pyvips.Image.black(w, h).add(80).cast("uchar").write_to_buffer(".png")


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
