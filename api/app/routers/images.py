"""Routes for image actions. Submissions are queued, not processed inline."""

from __future__ import annotations

import json
import shutil
import tempfile
from pathlib import Path
from typing import Any, List

from fastapi import APIRouter, File, Form, Header, HTTPException, Request, UploadFile

from app.core.config import settings
from app.jobs.schemas import JobAccepted
from app.services import imaging
from app.services.billing import EntitlementError, EntitlementStore, paywall_enabled
from app.services.crop import ASPECT_RATIOS
from app.services.filetype import detect_kind, kind_extension, refine_office_zip
from app.services.presets import get_preset
from app.services.ratelimit import SlidingWindowLimiter
from app.services.resize import WIDTH_PRESETS

router = APIRouter(prefix="/img", tags=["images"])

_CHUNK_SIZE = 1024 * 1024

# Image kinds libvips can read. BMP/GIF are input-only (no encode target).
_IMAGE_KINDS = {"png", "jpeg", "webp", "avif", "heif", "gif", "tiff", "bmp"}
# Fix jobs also accept documents so a UCAS or NHS file can be checked.
_FIX_KINDS = _IMAGE_KINDS | {"pdf", "doc", "docx", "odt", "zip"}

# Per-IP limiter for free fixer uploads. Rebuilt in tests by constructing a new one.
_fix_limiter = SlidingWindowLimiter(settings.fix_free_rate_per_minute, 60)


def _max_upload_bytes(*, for_fix: bool) -> int:
    """Byte ceiling for one uploaded file (fixer packs use a tighter cap)."""
    mb = settings.fix_max_upload_mb if for_fix else settings.max_upload_mb
    return mb * 1024 * 1024


def _client_ip(request: Request) -> str:
    """Client address used as the rate-limit key. X-Forwarded-For only when trusted."""
    if settings.trust_forwarded_ip:
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            return forwarded.split(",")[0].strip() or "unknown"
    if request.client is not None and request.client.host:
        return request.client.host
    return "unknown"


def _unsupported() -> HTTPException:
    """Generic rejection — never echo the upload name or bytes."""
    return HTTPException(
        status_code=400,
        detail="This file type is not supported. Use JPEG, PNG, WebP, PDF, DOC, or DOCX.",
    )


async def _stream_to_disk(file: UploadFile, dest: Path, allowed: set[str], *, for_fix: bool) -> str:
    """Stream an upload, detect its type from magic bytes, and return that kind."""
    size = 0
    detected: str | None = None
    ceiling = _max_upload_bytes(for_fix=for_fix)
    with dest.open("wb") as out:
        while True:
            chunk = await file.read(_CHUNK_SIZE)
            if not chunk:
                break
            if detected is None:
                detected = detect_kind(chunk)
                if detected is None:
                    raise _unsupported()
                if detected not in allowed and not (detected == "zip" and {"docx", "odt"} & allowed):
                    raise _unsupported()
            size += len(chunk)
            if size > ceiling:
                limit_mb = settings.fix_max_upload_mb if for_fix else settings.max_upload_mb
                raise HTTPException(
                    status_code=413,
                    detail=f"That file exceeds the {limit_mb} MB upload limit.",
                )
            out.write(chunk)
    if size == 0:
        raise HTTPException(status_code=400, detail="That file is empty.")
    if detected is None:
        raise HTTPException(status_code=400, detail="That file is empty.")
    if detected == "zip":
        refined = refine_office_zip(dest)
        if refined is None or refined not in allowed:
            raise _unsupported()
        detected = refined
    elif detected not in allowed:
        raise _unsupported()
    return detected


def _safe_name(filename: str | None, fallback: str) -> str:
    return Path(filename or fallback).name or fallback


async def _store_uploads(
    files: list[UploadFile],
    work_dir: Path,
    allowed: set[str],
    *,
    for_fix: bool = False,
) -> tuple[list[str], list[str], int]:
    """Validate + stream each upload to input-{i}{ext}; return names, exts, total bytes."""
    names: list[str] = []
    exts: list[str] = []
    total = 0
    for i, file in enumerate(files):
        part = work_dir / f"input-{i}.part"
        kind = await _stream_to_disk(file, part, allowed, for_fix=for_fix)
        ext = kind_extension(kind)
        dest = work_dir / f"input-{i}{ext}"
        part.rename(dest)
        names.append(_safe_name(file.filename, f"image-{i + 1}{ext}"))
        exts.append(ext)
        total += dest.stat().st_size
    return names, exts, total


async def _accept_job(request: Request, *, tool: str, workspace: Path, file_count: int, total_bytes: int, params: dict[str, Any]) -> JobAccepted:
    registry = request.app.state.registry
    job_queue = request.app.state.job_queue
    record = registry.create(tool=tool, workspace=workspace, file_count=file_count, total_bytes=total_bytes, params=params)
    try:
        await job_queue.publish(record.id)
    except Exception as exc:  # noqa: BLE001 - any publish failure must not leave a phantom queued job
        registry.discard(record.id)
        raise HTTPException(status_code=503, detail="The processing queue is unavailable right now. Please try again shortly.") from exc
    return JobAccepted(job_id=record.id, position=registry.position(record.id), queue_size=registry.queue_size())


async def _intake(
    request: Request,
    files: list[UploadFile],
    tool: str,
    prefix: str,
    extra: dict[str, Any],
    allowed: set[str] | None = None,
    *,
    for_fix: bool = False,
    max_files: int | None = None,
) -> JobAccepted:
    """Shared: make a workspace, store uploads, merge params, accept the job."""
    if not files:
        raise HTTPException(status_code=400, detail="No files were uploaded.")
    cap = max_files if max_files is not None else settings.max_files_per_request
    if len(files) > cap:
        raise HTTPException(status_code=400, detail=f"Too many files (max {cap} per request).")
    work_dir = Path(tempfile.mkdtemp(prefix=prefix))
    try:
        names, exts, total = await _store_uploads(
            files, work_dir, allowed or _IMAGE_KINDS, for_fix=for_fix
        )
    except Exception:
        shutil.rmtree(work_dir, ignore_errors=True)
        raise
    return await _accept_job(request, tool=tool, workspace=work_dir, file_count=len(names), total_bytes=total,
                             params={"names": names, "exts": exts, **extra})


@router.post("/convert", status_code=202, summary="Queue an image format conversion", response_model=JobAccepted)
async def convert(request: Request, files: List[UploadFile] = File(...), target: str = Form(...), quality: int | None = Form(None)) -> JobAccepted:
    if target not in imaging.ENCODE_TARGETS:
        raise HTTPException(status_code=400, detail="Invalid target format.")
    if quality is not None and not (1 <= quality <= 100):
        raise HTTPException(status_code=400, detail="Quality must be between 1 and 100.")
    return await _intake(request, files, "convert", "chowbea-img-convert-", {"target": target, "quality": quality})


@router.post("/compress", status_code=202, summary="Queue an image compression", response_model=JobAccepted)
async def compress(request: Request, files: List[UploadFile] = File(...), quality: int = Form(...)) -> JobAccepted:
    if not (1 <= quality <= 100):
        raise HTTPException(status_code=400, detail="Quality must be between 1 and 100.")
    return await _intake(request, files, "compress", "chowbea-img-compress-", {"quality": quality})


@router.post("/resize", status_code=202, summary="Queue an image resize", response_model=JobAccepted)
async def resize(request: Request, files: List[UploadFile] = File(...), mode: str = Form(...),
                 width: int | None = Form(None), height: int | None = Form(None),
                 lock_aspect: bool = Form(True), percent: float | None = Form(None), preset: str | None = Form(None)) -> JobAccepted:
    if mode not in ("dimensions", "percent", "preset"):
        raise HTTPException(status_code=400, detail="Invalid resize mode.")
    if mode == "percent" and (percent is None or percent <= 0 or percent > 1000):
        raise HTTPException(status_code=400, detail="Percent must be between 0 and 1000.")
    if mode == "preset" and preset not in WIDTH_PRESETS:
        raise HTTPException(status_code=400, detail="Unknown size preset.")
    if mode == "dimensions" and not (width or height):
        raise HTTPException(status_code=400, detail="A width or height is required.")
    if mode == "dimensions" and not lock_aspect and not (width and height):
        raise HTTPException(status_code=400, detail="Both width and height are required when aspect is unlocked.")
    return await _intake(request, files, "resize", "chowbea-img-resize-",
                         {"mode": mode, "width": width, "height": height, "lock_aspect": lock_aspect, "percent": percent, "preset": preset})


@router.post("/rotate", status_code=202, summary="Queue an image rotate/flip", response_model=JobAccepted)
async def rotate(request: Request, files: List[UploadFile] = File(...), rotation: int = Form(0), flip: str = Form("none")) -> JobAccepted:
    if rotation not in (0, 90, 180, 270):
        raise HTTPException(status_code=400, detail="Rotation must be 0, 90, 180, or 270.")
    if flip not in ("none", "horizontal", "vertical"):
        raise HTTPException(status_code=400, detail="Invalid flip.")
    if rotation == 0 and flip == "none":
        raise HTTPException(status_code=400, detail="Nothing to do: choose a rotation or a flip.")
    return await _intake(request, files, "rotate", "chowbea-img-rotate-", {"rotation": rotation, "flip": flip})


@router.post("/crop", status_code=202, summary="Queue an image crop", response_model=JobAccepted)
async def crop(request: Request, files: List[UploadFile] = File(...), mode: str = Form(...),
               aspect: str | None = Form(None), rect: str | None = Form(None)) -> JobAccepted:
    if mode == "aspect":
        if aspect not in ASPECT_RATIOS:
            raise HTTPException(status_code=400, detail="Unknown aspect ratio.")
        extra: dict[str, Any] = {"mode": "aspect", "aspect": aspect, "rect": None}
    elif mode == "rect":
        if len(files) != 1:
            raise HTTPException(status_code=400, detail="Freeform crop takes exactly one image.")
        try:
            parsed = json.loads(rect or "")
            box = {k: int(parsed[k]) for k in ("x", "y", "width", "height")}
        except (ValueError, TypeError, KeyError):
            raise HTTPException(status_code=400, detail="Invalid crop rectangle.") from None
        if box["width"] <= 0 or box["height"] <= 0 or box["x"] < 0 or box["y"] < 0:
            raise HTTPException(status_code=400, detail="Invalid crop rectangle.")
        extra = {"mode": "rect", "aspect": None, "rect": box}
    else:
        raise HTTPException(status_code=400, detail="Invalid crop mode.")
    return await _intake(request, files, "crop", "chowbea-img-crop-", extra)


def _bearer_token(authorization: str | None) -> str | None:
    """Pull a Bearer token from the Authorization header, if present."""
    if not authorization:
        return None
    scheme, _, value = authorization.partition(" ")
    if scheme.lower() != "bearer" or not value.strip():
        return None
    return value.strip()


def _entitlements(request: Request) -> EntitlementStore:
    """Process-wide store created at startup (tests attach one on app.state)."""
    store = getattr(request.app.state, "entitlements", None)
    if store is None:
        store = EntitlementStore()
        request.app.state.entitlements = store
    return store


@router.post("/fix", status_code=202, summary="Queue a file to meet a portal upload preset", response_model=JobAccepted)
async def fix(
    request: Request,
    files: List[UploadFile] = File(...),
    preset: str = Form(...),
    merge: bool = Form(False),
    token: str | None = Form(None),
    authorization: str | None = Header(None),
) -> JobAccepted:
    """Accept images or documents and queue a convert/resize/compress-to-preset job.

    One file is always free. Two or more files (an evidence pack) require a
    signed payment token when the Stripe paywall is on.
    """
    if get_preset(preset) is None:
        raise HTTPException(status_code=400, detail="Unknown preset.")
    is_batch = len(files) > 1
    raw_token = (token or "").strip() or _bearer_token(authorization)
    consumed = False
    store = _entitlements(request)
    if is_batch and paywall_enabled():
        if not raw_token:
            raise HTTPException(
                status_code=402,
                detail="An evidence pack needs a £1.99 payment or a 24-hour pass.",
            )
        try:
            store.consume(raw_token)
            consumed = True
        except EntitlementError as exc:
            raise HTTPException(status_code=402, detail=str(exc)) from exc
    # Free fixes (single file, or any pack while the paywall is off) share a per-IP cap.
    if not consumed:
        if not _fix_limiter.allow(_client_ip(request)):
            raise HTTPException(
                status_code=429,
                detail="Too many free fixes from this network. Try again in a minute.",
            )
    try:
        return await _intake(
            request,
            files,
            "fix",
            "chowbea-img-fix-",
            {"preset": preset, "merge": merge},
            allowed=_FIX_KINDS,
            for_fix=True,
            max_files=settings.fix_max_files,
        )
    except Exception:
        if consumed and raw_token:
            store.restore(raw_token)
        raise
