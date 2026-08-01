"""Executes queued jobs by dispatching to the image service functions.

libvips work is CPU-bound C that releases the GIL, so `execute_job` runs each
job on a worker thread to keep the event loop and HTTP endpoints responsive
while up to `job_concurrency` jobs run.
"""

from __future__ import annotations

import asyncio
import logging
import time
import zipfile
from pathlib import Path

from app.jobs.registry import JobRecord, JobRegistry, JobStatus
from app.jobs.stats import CounterStore
from app.services import imaging
from app.services.compress import CompressError, compress_image
from app.services.convert import ConvertError, convert_image
from app.services.crop import CropError, crop_image
from app.services.resize import ResizeError, resize_image
from app.services.rotate import RotateError, rotate_image

logger = logging.getLogger(__name__)

_KNOWN_ERRORS = (
    ConvertError,
    CompressError,
    ResizeError,
    RotateError,
    CropError,
    imaging.ImageError,
)


def _inputs(record: JobRecord) -> list[Path]:
    exts: list[str] = record.params["exts"]
    return [record.workspace / f"input-{i}{ext}" for i, ext in enumerate(exts)]


def _dedupe_names(names: list[str]) -> list[str]:
    """Make ZIP entry names unique, disambiguating collisions with -2, -3, …
    Checks each candidate against ALL names already emitted (originals and
    generated), so a generated name can't collide with a real one."""
    used: set[str] = set()
    deduped: list[str] = []
    for name in names:
        candidate = name
        stem, ext = Path(name).stem, Path(name).suffix
        count = 1
        while candidate in used:
            count += 1
            candidate = f"{stem}-{count}{ext}"
        used.add(candidate)
        deduped.append(candidate)
    return deduped


def _finish(record: JobRecord, outputs: list[tuple[Path, str]], media_type: str, zip_name: str) -> None:
    """One image → return it; many → zip them under their download names."""
    if len(outputs) == 1:
        record.result_path, record.download_name = outputs[0]
        record.media_type = media_type
        return
    archive = record.workspace / zip_name
    arcnames = _dedupe_names([arcname for _, arcname in outputs])
    with zipfile.ZipFile(archive, "w", zipfile.ZIP_DEFLATED) as zf:
        for (path, _), arcname in zip(outputs, arcnames):
            zf.write(path, arcname=arcname)
    record.result_path = archive
    record.download_name = zip_name
    record.media_type = "application/zip"


def _out_name(name: str, ext: str) -> str:
    return f"{Path(name).stem or 'image'}{ext}"


def _run_convert(record: JobRecord) -> None:
    names = record.params["names"]
    target = record.params["target"]
    quality = record.params.get("quality")
    ext = imaging.ENCODE_TARGETS[target]
    outputs: list[tuple[Path, str]] = []
    for i, (src, name) in enumerate(zip(_inputs(record), names)):
        dst = record.workspace / f"output-{i}{ext}"
        convert_image(src, dst, target, quality)
        outputs.append((dst, _out_name(name, ext)))
    _finish(record, outputs, imaging.MEDIA_TYPES[target], "converted-images.zip")


def _run_keep_format(record: JobRecord, op) -> None:
    """Shared driver for compress/resize/rotate/crop — each keeps the input format."""
    names = record.params["names"]
    exts = record.params["exts"]
    outputs: list[tuple[Path, str]] = []
    for i, (src, name, ext) in enumerate(zip(_inputs(record), names, exts)):
        dst = record.workspace / f"output-{i}{ext}"
        op(src, dst)
        outputs.append((dst, _out_name(name, ext)))
    media_type = imaging.MEDIA_TYPE_BY_EXT.get(exts[0].lower(), "application/octet-stream")
    _finish(record, outputs, media_type, "images.zip")


def _run_compress(record: JobRecord) -> None:
    quality = record.params["quality"]
    _run_keep_format(record, lambda s, d: compress_image(s, d, quality))


def _run_resize(record: JobRecord) -> None:
    p = record.params
    _run_keep_format(record, lambda s, d: resize_image(
        s, d, mode=p["mode"], width=p.get("width"), height=p.get("height"),
        lock_aspect=p.get("lock_aspect", True), percent=p.get("percent"), preset=p.get("preset")))


def _run_rotate(record: JobRecord) -> None:
    p = record.params
    _run_keep_format(record, lambda s, d: rotate_image(s, d, rotation=p["rotation"], flip=p["flip"]))


def _run_crop(record: JobRecord) -> None:
    p = record.params
    _run_keep_format(record, lambda s, d: crop_image(s, d, mode=p["mode"], aspect=p.get("aspect"), rect=p.get("rect")))


_RUNNERS = {
    "convert": _run_convert,
    "compress": _run_compress,
    "resize": _run_resize,
    "rotate": _run_rotate,
    "crop": _run_crop,
}


def run_job(record: JobRecord) -> None:
    """Synchronously execute one job; raises service errors on failure."""
    runner = _RUNNERS.get(record.tool)
    if runner is None:
        raise ValueError(f"Unknown tool '{record.tool}'")
    runner(record)


async def execute_job(registry: JobRegistry, job_id: str, counter: CounterStore | None = None) -> None:
    """Consumer handler: run one job and record the outcome on the registry."""
    record = registry.get(job_id)
    if record is None:
        logger.warning("Dropping job %s with no registry entry", job_id)
        return
    if record.status is not JobStatus.queued:
        logger.warning("Ignoring redelivery of job %s in state %s", job_id, record.status.value)
        return

    record.status = JobStatus.processing
    record.started_at = time.time()
    try:
        await asyncio.to_thread(run_job, record)
    except _KNOWN_ERRORS as exc:
        record.status = JobStatus.failed
        record.error = str(exc)
    except Exception:
        logger.exception("Job %s crashed", job_id)
        record.status = JobStatus.failed
        record.error = "Something went wrong while processing this image."
    else:
        record.status = JobStatus.done
        if counter is not None:
            counter.increment()
    finally:
        record.finished_at = time.time()
