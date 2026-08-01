import asyncio
import zipfile
from pathlib import Path

import pyvips

from app.jobs.registry import JobRegistry, JobStatus
from app.jobs.worker import execute_job, run_job


def _seed(registry, tmp_path, tool, params, exts):
    ws = tmp_path / tool
    ws.mkdir()
    for i, ext in enumerate(exts):
        pyvips.Image.black(20, 10).add(50).cast("uchar").write_to_file(str(ws / f"input-{i}{ext}"))
    params = {**params, "exts": exts}
    return registry.create(tool=tool, workspace=ws, file_count=len(exts), total_bytes=0, params=params)


def test_run_convert_single_returns_image(tmp_path):
    reg = JobRegistry()
    rec = _seed(reg, tmp_path, "convert", {"names": ["a.png"], "target": "jpeg", "quality": 80}, [".png"])
    run_job(rec)
    assert rec.result_path.suffix == ".jpg"
    assert rec.media_type == "image/jpeg"
    assert pyvips.Image.new_from_file(str(rec.result_path)).get("vips-loader") == "jpegload"


def test_run_convert_batch_returns_zip(tmp_path):
    reg = JobRegistry()
    rec = _seed(reg, tmp_path, "convert",
                {"names": ["a.png", "b.png"], "target": "webp", "quality": 75}, [".png", ".png"])
    run_job(rec)
    assert rec.media_type == "application/zip"
    with zipfile.ZipFile(rec.result_path) as zf:
        assert sorted(zf.namelist()) == ["a.webp", "b.webp"]


def test_execute_job_marks_done_and_increments(tmp_path):
    reg = JobRegistry()
    rec = _seed(reg, tmp_path, "rotate", {"names": ["a.png"], "rotation": 90, "flip": "none"}, [".png"])

    class Counter:
        def __init__(self): self.n = 0
        def increment(self): self.n += 1; return self.n

    counter = Counter()
    asyncio.run(execute_job(reg, rec.id, counter))
    assert rec.status is JobStatus.done
    assert counter.n == 1
