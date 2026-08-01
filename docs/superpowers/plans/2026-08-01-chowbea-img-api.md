# Chowbea Image — Backend (api) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the `api/` FastAPI backend for Chowbea Image — a queued, libvips-powered service exposing convert/compress/resize/rotate/crop over a RabbitMQ job queue, an architectural twin of `chowbea-pdf/api`.

**Architecture:** FastAPI accepts multipart uploads, streams them to a per-job temp workspace with per-format validation, registers a job in an in-process `JobRegistry`, and publishes only the job id to the `img-jobs` RabbitMQ queue. A consumer inside the API process runs up to 3 jobs at a time on worker threads (libvips is fast + releases the GIL), each dispatching to a per-tool service. Clients poll `GET /jobs/{id}` and download the result (single image, or a ZIP for a batch). A public `GET /queue` board and a durable jobs-completed counter mirror the PDF app.

**Tech Stack:** Python ≥3.12, uv, FastAPI 0.115.x, uvicorn, aio-pika (RabbitMQ), pydantic-settings, **pyvips** (bindings for the **libvips** system library).

## Global Constraints

Every task's requirements implicitly include these:

- Python `>=3.12`; managed by `uv` with `[tool.uv] package = false` (app, not a library).
- Settings read from env with prefix `CHOWBEA_` (via `pydantic-settings`), `.env` supported.
- Queue name is exactly `img-jobs`.
- Attribution string written to output metadata is exactly `Chowbea Image (img.chowbea.com)` — always-on, in **both** EXIF `Software` and XMP.
- `max_upload_mb` default `100`; `max_image_megapixels` default `300`; `result_ttl_minutes` default `30`; `job_concurrency` default `3`.
- Encode (Convert) targets: `png, jpeg, webp, avif, tiff`. Decode (input) kinds: `png, jpeg, webp, avif, heic/heif, gif, tiff, bmp`. (BMP/GIF are input-only — libvips has no dependable BMP saver and v1 flattens animation.)
- Only **Convert** changes format; compress/resize/rotate/crop keep each input's own format.
- Reused-verbatim files come from the sibling repo at `../chowbea-pdf/api/app/...`. "Copy verbatim" means `cp` the real file, then apply the listed edits — the source exists and is readable.
- TDD: write the failing test first, watch it fail, implement minimally, watch it pass, commit. Small commits.
- All shell commands run from `chowbea-img/api/` unless stated. Tests run with `uv run pytest`.

**Local prerequisite (one-time):** libvips must be installed for `pyvips` to import.
- macOS: `brew install vips`
- Debian/Ubuntu (CI/Docker, later plan): `apt-get install -y libvips`

---

### Task 1: Scaffold the api project

**Files:**
- Create: `api/pyproject.toml`
- Create: `api/.python-version`
- Create: `api/app/__init__.py`, `api/app/core/__init__.py`, `api/app/jobs/__init__.py`, `api/app/routers/__init__.py`, `api/app/services/__init__.py`
- Create: `api/tests/__init__.py`
- Test: `api/tests/test_smoke.py`

**Interfaces:**
- Produces: an installable, testable `app` package; `pyvips` importable.

- [ ] **Step 1: Install libvips locally** (skip if `vips --version` already prints)

Run: `brew install vips` (macOS) — needed for the next steps to import pyvips.

- [ ] **Step 2: Write `api/pyproject.toml`**

```toml
[project]
name = "chowbea-image-api"
version = "0.1.0"
description = "FastAPI backend for batch image actions (convert, compress, resize, rotate, crop)."
requires-python = ">=3.12"
dependencies = [
    "fastapi==0.115.6",
    "uvicorn[standard]==0.34.0",
    "python-multipart==0.0.20",
    "pydantic-settings==2.7.1",
    "aio-pika==9.6.2",
    "pyvips==2.2.3",
]

[tool.uv]
package = false

[dependency-groups]
dev = [
    "httpx>=0.28.1",
    "pytest==8.3.4",
]

[tool.pytest.ini_options]
pythonpath = ["."]
testpaths = ["tests"]
```

- [ ] **Step 3: Write `api/.python-version`**

```
3.12
```

- [ ] **Step 4: Create empty package markers**

Create each of these as empty files: `app/__init__.py`, `app/core/__init__.py`, `app/jobs/__init__.py`, `app/routers/__init__.py`, `app/services/__init__.py`, `tests/__init__.py`.

- [ ] **Step 5: Write the smoke test** `api/tests/test_smoke.py`

```python
def test_pyvips_imports_and_libvips_present():
    import pyvips

    # A trivial black image proves libvips is wired up end to end.
    image = pyvips.Image.black(4, 4)
    assert image.width == 4
    assert image.height == 4
```

- [ ] **Step 6: Sync and run the test**

Run: `uv sync && uv run pytest tests/test_smoke.py -v`
Expected: PASS (if it errors on `pyvips`, libvips is not installed — revisit Step 1).

- [ ] **Step 7: Commit**

```bash
git add api/
git commit -m "chore(api): scaffold FastAPI + pyvips project"
```

---

### Task 2: Settings

**Files:**
- Create: `api/app/core/config.py`
- Test: `api/tests/test_config.py`

**Interfaces:**
- Produces: `settings` singleton with `app_name, app_version, cors_origins, cors_origin_list, max_upload_mb, max_image_megapixels, rabbitmq_url, result_ttl_minutes, job_concurrency, commit_sha, data_dir`.

- [ ] **Step 1: Write the failing test** `api/tests/test_config.py`

```python
from app.core.config import Settings


def test_defaults():
    s = Settings()
    assert s.app_name == "Chowbea Image API"
    assert s.max_upload_mb == 100
    assert s.max_image_megapixels == 300
    assert s.result_ttl_minutes == 30
    assert s.job_concurrency == 3
    assert s.commit_sha == "dev"


def test_cors_origin_list_splits_and_strips():
    s = Settings(cors_origins="http://a.com, http://b.com ,")
    assert s.cors_origin_list == ["http://a.com", "http://b.com"]
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run pytest tests/test_config.py -v`
Expected: FAIL with `ModuleNotFoundError: app.core.config`.

- [ ] **Step 3: Write `api/app/core/config.py`**

```python
"""Application configuration loaded from the environment."""

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime settings for the API.

    Values are read from environment variables (and a local .env file when present),
    so the same image can be configured differently per deployment.
    """

    app_name: str = "Chowbea Image API"
    app_version: str = "0.1.0"

    # Origins allowed to call the API from a browser. Comma-separated in the env var.
    cors_origins: str = "http://localhost:3000"

    # Reject uploads larger than this (in megabytes) to protect the server.
    max_upload_mb: int = 100

    # Reject images whose pixel count (w*h) exceeds this many megapixels; a cheap,
    # header-only guard against decompression bombs.
    max_image_megapixels: int = 300

    # AMQP URL of the RabbitMQ broker that carries the job queue.
    rabbitmq_url: str = "amqp://guest:guest@localhost:5672/"

    # Finished job results are kept this long before being swept from disk.
    result_ttl_minutes: int = 30

    # How many jobs may be processed at the same time (RabbitMQ prefetch count).
    job_concurrency: int = 3

    # Git SHA of the running deploy; Railway injects this on git-connected deploys.
    commit_sha: str = Field(default="dev", validation_alias="RAILWAY_GIT_COMMIT_SHA")

    # Directory for small durable state (the jobs counter); a Railway volume is
    # mounted here in production so the data survives redeploys.
    data_dir: str = "./data"

    model_config = SettingsConfigDict(env_file=".env", env_prefix="CHOWBEA_")

    @property
    def cors_origin_list(self) -> list[str]:
        """Return the configured CORS origins as a clean list."""
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


# A single shared settings instance for the whole app.
settings = Settings()
```

- [ ] **Step 4: Run test to verify it passes**

Run: `uv run pytest tests/test_config.py -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/core/config.py tests/test_config.py
git commit -m "feat(api): add settings"
```

---

### Task 3: Job registry (reuse)

**Files:**
- Create: `api/app/jobs/registry.py` (copy verbatim from `../chowbea-pdf/api/app/jobs/registry.py`)
- Test: `api/tests/test_registry.py` (copy verbatim from `../chowbea-pdf/api/tests/test_registry.py`)

**Interfaces:**
- Produces: `JobStatus` (Enum: queued/processing/done/failed), `JobRecord` dataclass (`id, tool, workspace, file_count, total_bytes, params, status, error, result_path, download_name, media_type, result_headers, created_at, started_at, finished_at`), and `JobRegistry` with `create(*, tool, workspace, file_count, total_bytes, params) -> JobRecord`, `get(id)`, `discard(id)`, `position(id)`, `queue_size()`, `processing()`, `waiting()`, `sweep(now=None)`.

- [ ] **Step 1: Copy the files verbatim**

```bash
cp ../chowbea-pdf/api/app/jobs/registry.py app/jobs/registry.py
cp ../chowbea-pdf/api/tests/test_registry.py tests/test_registry.py
```

No edits needed — the registry is tool-agnostic.

- [ ] **Step 2: Run the tests**

Run: `uv run pytest tests/test_registry.py -v`
Expected: PASS. (If the copied test imports anything PDF-specific, it does not — it uses only `app.jobs.registry`.)

- [ ] **Step 3: Commit**

```bash
git add app/jobs/registry.py tests/test_registry.py
git commit -m "feat(api): add job registry (reused from chowbea-pdf)"
```

---

### Task 4: Job schemas (reuse)

**Files:**
- Create: `api/app/jobs/schemas.py` (copy verbatim from `../chowbea-pdf/api/app/jobs/schemas.py`)

**Interfaces:**
- Produces: `JobAccepted {job_id, position, queue_size}`, `JobStatusResponse {id, tool, status, position, queue_size, error, file_count, total_bytes, created_at}`, `BoardEntry {id_prefix, tool, file_count, total_bytes, created_at}`, `QueueBoard {concurrency, jobs_completed, processing, waiting}`.

- [ ] **Step 1: Copy the file verbatim**

```bash
cp ../chowbea-pdf/api/app/jobs/schemas.py app/jobs/schemas.py
```

Identical — the schemas describe the tool-agnostic job envelope. No dedicated test; these are exercised by the endpoint tests in Tasks 14–15.

- [ ] **Step 2: Verify it imports**

Run: `uv run python -c "from app.jobs import schemas; print(schemas.QueueBoard.__name__)"`
Expected: prints `QueueBoard`.

- [ ] **Step 3: Commit**

```bash
git add app/jobs/schemas.py
git commit -m "feat(api): add job schemas (reused from chowbea-pdf)"
```

---

### Task 5: Durable jobs counter (reuse)

**Files:**
- Create: `api/app/jobs/stats.py` (copy verbatim from `../chowbea-pdf/api/app/jobs/stats.py`)
- Test: `api/tests/test_stats.py` (copy verbatim from `../chowbea-pdf/api/tests/test_stats.py`)

**Interfaces:**
- Produces: `CounterStore(path: Path)` with `.count` property and `.increment() -> int` (atomic temp+replace write).

- [ ] **Step 1: Copy the files verbatim**

```bash
cp ../chowbea-pdf/api/app/jobs/stats.py app/jobs/stats.py
cp ../chowbea-pdf/api/tests/test_stats.py tests/test_stats.py
```

- [ ] **Step 2: Run the tests**

Run: `uv run pytest tests/test_stats.py -v`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add app/jobs/stats.py tests/test_stats.py
git commit -m "feat(api): add durable jobs counter (reused from chowbea-pdf)"
```

---

### Task 6: Queue plumbing (reuse, rename queue)

**Files:**
- Create: `api/app/jobs/queue.py` (copy from `../chowbea-pdf/api/app/jobs/queue.py`, one edit)
- Test: `api/tests/test_queue.py` (copy verbatim from `../chowbea-pdf/api/tests/test_queue.py`)

**Interfaces:**
- Produces: `QUEUE_NAME = "img-jobs"`, `QueueUnavailableError`, `encode_job(job_id) -> bytes`, `decode_job(body) -> str | None`, `JobQueue(url, prefetch)` with `.ready`, `connect()`, `publish(job_id)`, `start_consumer(handler)`, `close()`.

- [ ] **Step 1: Copy and edit**

```bash
cp ../chowbea-pdf/api/app/jobs/queue.py app/jobs/queue.py
cp ../chowbea-pdf/api/tests/test_queue.py tests/test_queue.py
```

Edit `app/jobs/queue.py`: change the queue name constant.

```python
# was: QUEUE_NAME = "pdf-jobs"
QUEUE_NAME = "img-jobs"
```

If `tests/test_queue.py` asserts on the queue name string `"pdf-jobs"`, update that literal to `"img-jobs"`.

- [ ] **Step 2: Run the tests**

Run: `uv run pytest tests/test_queue.py -v`
Expected: PASS. (These tests cover `encode_job`/`decode_job` and do not need a live broker.)

- [ ] **Step 3: Commit**

```bash
git add app/jobs/queue.py tests/test_queue.py
git commit -m "feat(api): add img-jobs queue plumbing (reused from chowbea-pdf)"
```

---

### Task 7: Imaging core (libvips load/save + metadata policy) — NEW

**Files:**
- Create: `api/app/services/imaging.py`
- Test: `api/tests/test_imaging.py`

**Interfaces:**
- Produces:
  - `ImageError(Exception)` — user-facing imaging failure.
  - `TooManyPixelsError(ImageError)` — decompression-bomb guard tripped.
  - `ATTRIBUTION = "Chowbea Image (img.chowbea.com)"`.
  - `ENCODE_TARGETS: dict[str, str]` mapping target name → file extension (`{"png": ".png", "jpeg": ".jpg", "webp": ".webp", "avif": ".avif", "tiff": ".tiff"}`).
  - `MEDIA_TYPES: dict[str, str]` mapping target → MIME.
  - `load(src: Path) -> pyvips.Image` — sequential access, `autorot()`, megapixel guard.
  - `save(image, dst: Path, *, quality: int | None = None) -> None` — strips inherited metadata, stamps attribution in EXIF+XMP, writes by `dst` extension with quality where relevant.

- [ ] **Step 1: Write the failing tests** `api/tests/test_imaging.py`

```python
import pyvips
import pytest

from app.services import imaging


def _write_source(path, width=32, height=16, fmt=".png"):
    # A simple gradient with EXIF GPS + Software set, so we can prove stripping.
    img = pyvips.Image.black(width, height).add(64).cast("uchar").copy()
    img = img.copy()
    img.set_type(pyvips.GValue.gstr_type, "exif-ifd0-Software", "SomeOtherApp")
    img.write_to_file(str(path))
    return path


def test_load_rejects_too_many_pixels(tmp_path, monkeypatch):
    monkeypatch.setattr(imaging.settings, "max_image_megapixels", 1)  # 1 MP cap
    src = tmp_path / "big.png"
    pyvips.Image.black(2000, 2000).write_to_file(str(src))  # 4 MP
    with pytest.raises(imaging.TooManyPixelsError):
        imaging.load(src)


def test_save_strips_metadata_and_stamps_attribution(tmp_path):
    src = _write_source(tmp_path / "in.png")
    out = tmp_path / "out.jpg"
    imaging.save(imaging.load(src), out, quality=80)

    result = pyvips.Image.new_from_file(str(out))
    software = result.get("exif-ifd0-Software")
    assert imaging.ATTRIBUTION in software
    assert "SomeOtherApp" not in software


def test_save_writes_requested_format_by_extension(tmp_path):
    src = _write_source(tmp_path / "in.png")
    out = tmp_path / "out.webp"
    imaging.save(imaging.load(src), out, quality=75)
    assert pyvips.Image.new_from_file(str(out)).get("vips-loader") == "webpload"
```

- [ ] **Step 2: Run to verify failure**

Run: `uv run pytest tests/test_imaging.py -v`
Expected: FAIL (`ModuleNotFoundError: app.services.imaging`).

- [ ] **Step 3: Write `api/app/services/imaging.py`**

```python
"""libvips load/save helpers shared by every image tool.

Centralizes two cross-cutting concerns so they live in exactly one place:
the decompression-bomb guard (on load) and the metadata policy (on save) —
strip everything a source carried, then stamp our own attribution.
"""

from __future__ import annotations

from pathlib import Path

import pyvips

from app.core.config import settings

ATTRIBUTION = "Chowbea Image (img.chowbea.com)"

# Minimal XMP packet carrying the same attribution, written verbatim.
_XMP_PACKET = (
    '<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?>'
    '<x:xmpmeta xmlns:x="adobe:ns:meta/">'
    '<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">'
    '<rdf:Description rdf:about="" xmlns:xmp="http://ns.adobe.com/xap/1.0/">'
    f"<xmp:CreatorTool>{ATTRIBUTION}</xmp:CreatorTool>"
    "</rdf:Description></rdf:RDF></x:xmpmeta>"
    '<?xpacket end="w"?>'
).encode("utf-8")

# Convert target name -> output extension and MIME type.
ENCODE_TARGETS: dict[str, str] = {
    "png": ".png",
    "jpeg": ".jpg",
    "webp": ".webp",
    "avif": ".avif",
    "tiff": ".tiff",
}
MEDIA_TYPES: dict[str, str] = {
    "png": "image/png",
    "jpeg": "image/jpeg",
    "webp": "image/webp",
    "avif": "image/avif",
    "tiff": "image/tiff",
}

# Metadata field-name prefixes we drop on save (everything a source can carry
# that could leak GPS/camera/timestamps or crafted payloads). The ICC profile
# is deliberately kept for colour fidelity.
_STRIP_PREFIXES = ("exif-", "xmp", "iptc", "ipct", "photoshop", "png-comment", "gif-comment")


class ImageError(Exception):
    """A user-facing imaging failure (bad image, unsupported operation)."""


class TooManyPixelsError(ImageError):
    """The image exceeds the configured megapixel ceiling."""


def load(src: Path) -> pyvips.Image:
    """Open an image for streaming processing.

    Applies EXIF orientation into the pixels (so nothing downstream has to think
    about rotation) and rejects images whose pixel count exceeds the configured
    ceiling — a cheap, header-only guard against decompression bombs.
    """
    try:
        image = pyvips.Image.new_from_file(str(src), access="sequential")
    except pyvips.Error as exc:  # unreadable / unsupported / corrupt
        raise ImageError("The image could not be read.") from exc

    megapixels = (image.width * image.height) / 1_000_000
    if megapixels > settings.max_image_megapixels:
        raise TooManyPixelsError(
            f"Image is too large to process ({megapixels:.0f} MP; "
            f"limit is {settings.max_image_megapixels} MP)."
        )
    return image.autorot()


def _stamp_and_strip(image: pyvips.Image) -> pyvips.Image:
    """Return a copy with inherited metadata removed and our attribution set."""
    image = image.copy()
    for field in image.get_fields():
        if field.startswith(_STRIP_PREFIXES):
            image.remove(field)
    image.set_type(pyvips.GValue.gstr_type, "exif-ifd0-Software", ATTRIBUTION)
    image.set_type(pyvips.GValue.blob_type, "xmp-data", _XMP_PACKET)
    return image


def save(image: pyvips.Image, dst: Path, *, quality: int | None = None) -> None:
    """Write `image` to `dst`, choosing the encoder from the extension.

    Keeps only EXIF, XMP, and the ICC profile (our attribution rides in EXIF +
    XMP); everything else is stripped by `_stamp_and_strip` beforehand.
    """
    image = _stamp_and_strip(image)
    keep = pyvips.ForeignKeep.EXIF | pyvips.ForeignKeep.XMP | pyvips.ForeignKeep.ICC

    opts: dict[str, object] = {"keep": keep}
    suffix = dst.suffix.lower()
    if quality is not None and suffix in (".jpg", ".jpeg", ".webp", ".avif", ".heic", ".heif"):
        opts["Q"] = quality
    if suffix == ".png" and quality is not None:
        # For PNG, "quality" means lossy palette quantisation.
        opts["palette"] = True
        opts["Q"] = quality
    try:
        image.write_to_file(str(dst), **opts)
    except pyvips.Error as exc:
        raise ImageError("The image could not be written.") from exc
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `uv run pytest tests/test_imaging.py -v`
Expected: PASS. If `test_save_strips_metadata_and_stamps_attribution` fails because libvips annotates the EXIF string (e.g. returns `"Chowbea Image (img.chowbea.com) (17, ASCII, 30 components)"`), the `in` assertion still holds — that is why the test uses `in`, not `==`. If `get("exif-ifd0-Software")` raises because no EXIF block was written, adjust `keep` to ensure EXIF is retained and re-run.

- [ ] **Step 5: Commit**

```bash
git add app/services/imaging.py tests/test_imaging.py
git commit -m "feat(api): add libvips imaging core with metadata policy"
```

---

### Task 8: Convert service — NEW

**Files:**
- Create: `api/app/services/convert.py`
- Test: `api/tests/test_convert_service.py`

**Interfaces:**
- Consumes: `imaging.load`, `imaging.save`, `imaging.ENCODE_TARGETS`, `imaging.ImageError`.
- Produces: `ConvertError(Exception)`; `convert_image(src: Path, dst: Path, target: str, quality: int | None) -> None`.

- [ ] **Step 1: Write the failing test** `api/tests/test_convert_service.py`

```python
from pathlib import Path

import pyvips
import pytest

from app.services.convert import ConvertError, convert_image


def _png(path: Path, w=24, h=12) -> Path:
    pyvips.Image.black(w, h).add(120).cast("uchar").write_to_file(str(path))
    return path


def test_convert_png_to_jpeg(tmp_path):
    src = _png(tmp_path / "in.png")
    dst = tmp_path / "out.jpg"
    convert_image(src, dst, "jpeg", 82)
    assert dst.exists()
    assert pyvips.Image.new_from_file(str(dst)).get("vips-loader") == "jpegload"


def test_convert_unknown_target_raises(tmp_path):
    src = _png(tmp_path / "in.png")
    with pytest.raises(ConvertError):
        convert_image(src, tmp_path / "out.xyz", "xyz", None)
```

- [ ] **Step 2: Run to verify failure**

Run: `uv run pytest tests/test_convert_service.py -v`
Expected: FAIL (`ModuleNotFoundError`).

- [ ] **Step 3: Write `api/app/services/convert.py`**

```python
"""Convert an image to another format via libvips."""

from __future__ import annotations

from pathlib import Path

from app.services import imaging


class ConvertError(Exception):
    """A conversion failed for a reason worth showing the user."""


def convert_image(src: Path, dst: Path, target: str, quality: int | None) -> None:
    if target not in imaging.ENCODE_TARGETS:
        raise ConvertError(f"Cannot convert to '{target}'.")
    try:
        imaging.save(imaging.load(src), dst, quality=quality)
    except imaging.ImageError as exc:
        raise ConvertError(str(exc)) from exc
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `uv run pytest tests/test_convert_service.py -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/services/convert.py tests/test_convert_service.py
git commit -m "feat(api): add convert service"
```

---

### Task 9: Compress service — NEW

**Files:**
- Create: `api/app/services/compress.py`
- Test: `api/tests/test_compress_service.py`

**Interfaces:**
- Consumes: `imaging.load`, `imaging.save`, `imaging.ImageError`.
- Produces: `CompressError(Exception)`; `compress_image(src: Path, dst: Path, quality: int) -> None`. `dst` shares `src`'s extension (caller keeps the format).

- [ ] **Step 1: Write the failing test** `api/tests/test_compress_service.py`

```python
from pathlib import Path

import pyvips

from app.services.compress import compress_image


def _jpeg(path: Path, w=256, h=256) -> Path:
    # High-frequency noise so a lower Q measurably shrinks the file.
    pyvips.Image.gaussnoise(w, h).cast("uchar").write_to_file(str(path), Q=95)
    return path


def test_compress_shrinks_jpeg_and_keeps_format(tmp_path):
    src = _jpeg(tmp_path / "in.jpg")
    dst = tmp_path / "out.jpg"
    compress_image(src, dst, quality=30)
    assert dst.exists()
    assert dst.stat().st_size < src.stat().st_size
    assert pyvips.Image.new_from_file(str(dst)).get("vips-loader") == "jpegload"
```

- [ ] **Step 2: Run to verify failure**

Run: `uv run pytest tests/test_compress_service.py -v`
Expected: FAIL (`ModuleNotFoundError`).

- [ ] **Step 3: Write `api/app/services/compress.py`**

```python
"""Shrink an image's file size without changing its format."""

from __future__ import annotations

from pathlib import Path

from app.services import imaging


class CompressError(Exception):
    """Compression failed for a reason worth showing the user."""


def compress_image(src: Path, dst: Path, quality: int) -> None:
    """Re-encode `src` into `dst` (same format, chosen by dst's extension) at
    the given quality. For lossy formats this is the Q factor; for PNG it drives
    palette quantisation (see imaging.save)."""
    try:
        imaging.save(imaging.load(src), dst, quality=quality)
    except imaging.ImageError as exc:
        raise CompressError(str(exc)) from exc
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `uv run pytest tests/test_compress_service.py -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/services/compress.py tests/test_compress_service.py
git commit -m "feat(api): add compress service"
```

---

### Task 10: Resize service — NEW

**Files:**
- Create: `api/app/services/resize.py`
- Test: `api/tests/test_resize_service.py`

**Interfaces:**
- Consumes: `imaging.load`, `imaging.save`, `imaging.ImageError`.
- Produces: `ResizeError(Exception)`; `WIDTH_PRESETS: dict[str, int]` (`{"1920": 1920, "1280": 1280, "640": 640}`); `resize_image(src, dst, *, mode, width=None, height=None, lock_aspect=True, percent=None, preset=None) -> None`. `mode ∈ {"dimensions","percent","preset"}`.

- [ ] **Step 1: Write the failing test** `api/tests/test_resize_service.py`

```python
from pathlib import Path

import pyvips
import pytest

from app.services.resize import ResizeError, resize_image


def _png(path: Path, w=400, h=200) -> Path:
    pyvips.Image.black(w, h).add(90).cast("uchar").write_to_file(str(path))
    return path


def test_resize_percent_halves(tmp_path):
    src = _png(tmp_path / "in.png", 400, 200)
    dst = tmp_path / "out.png"
    resize_image(src, dst, mode="percent", percent=50)
    out = pyvips.Image.new_from_file(str(dst))
    assert (out.width, out.height) == (200, 100)


def test_resize_dimensions_lock_aspect_uses_width(tmp_path):
    src = _png(tmp_path / "in.png", 400, 200)
    dst = tmp_path / "out.png"
    resize_image(src, dst, mode="dimensions", width=100, height=999, lock_aspect=True)
    out = pyvips.Image.new_from_file(str(dst))
    assert (out.width, out.height) == (100, 50)


def test_resize_preset(tmp_path):
    src = _png(tmp_path / "in.png", 3840, 2160)
    dst = tmp_path / "out.png"
    resize_image(src, dst, mode="preset", preset="1920")
    assert pyvips.Image.new_from_file(str(dst)).width == 1920


def test_resize_bad_mode_raises(tmp_path):
    src = _png(tmp_path / "in.png")
    with pytest.raises(ResizeError):
        resize_image(src, tmp_path / "o.png", mode="nope")
```

- [ ] **Step 2: Run to verify failure**

Run: `uv run pytest tests/test_resize_service.py -v`
Expected: FAIL (`ModuleNotFoundError`).

- [ ] **Step 3: Write `api/app/services/resize.py`**

```python
"""Resize an image by dimensions, percentage, or a named width preset."""

from __future__ import annotations

from pathlib import Path

import pyvips

from app.services import imaging

WIDTH_PRESETS: dict[str, int] = {"1920": 1920, "1280": 1280, "640": 640}


class ResizeError(Exception):
    """A resize failed for a reason worth showing the user."""


def _target_dimensions(
    src_w: int,
    src_h: int,
    *,
    mode: str,
    width: int | None,
    height: int | None,
    lock_aspect: bool,
    percent: float | None,
    preset: str | None,
) -> tuple[int, int]:
    if mode == "percent":
        if not percent or percent <= 0:
            raise ResizeError("A positive percentage is required.")
        return max(1, round(src_w * percent / 100)), max(1, round(src_h * percent / 100))
    if mode == "preset":
        target_w = WIDTH_PRESETS.get(preset or "")
        if target_w is None:
            raise ResizeError("Unknown size preset.")
        return target_w, max(1, round(src_h * target_w / src_w))
    if mode == "dimensions":
        if lock_aspect:
            if width:
                return width, max(1, round(src_h * width / src_w))
            if height:
                return max(1, round(src_w * height / src_h)), height
            raise ResizeError("A width or height is required.")
        if not width or not height:
            raise ResizeError("Both width and height are required when aspect is unlocked.")
        return width, height
    raise ResizeError("Unknown resize mode.")


def resize_image(
    src: Path,
    dst: Path,
    *,
    mode: str,
    width: int | None = None,
    height: int | None = None,
    lock_aspect: bool = True,
    percent: float | None = None,
    preset: str | None = None,
) -> None:
    try:
        image = imaging.load(src)
    except imaging.ImageError as exc:
        raise ResizeError(str(exc)) from exc

    target_w, target_h = _target_dimensions(
        image.width,
        image.height,
        mode=mode,
        width=width,
        height=height,
        lock_aspect=lock_aspect,
        percent=percent,
        preset=preset,
    )
    # thumbnail_image is libvips' fast, high-quality resizer; force the exact
    # box (no upscale guard) so unlocked dimensions are honoured precisely.
    resized = image.thumbnail_image(target_w, height=target_h, size=pyvips.Size.FORCE)
    try:
        imaging.save(resized, dst)
    except imaging.ImageError as exc:
        raise ResizeError(str(exc)) from exc
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `uv run pytest tests/test_resize_service.py -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/services/resize.py tests/test_resize_service.py
git commit -m "feat(api): add resize service"
```

---

### Task 11: Rotate/flip service — NEW

**Files:**
- Create: `api/app/services/rotate.py`
- Test: `api/tests/test_rotate_service.py`

**Interfaces:**
- Consumes: `imaging.load`, `imaging.save`, `imaging.ImageError`.
- Produces: `RotateError(Exception)`; `rotate_image(src, dst, *, rotation: int, flip: str) -> None`. `rotation ∈ {0,90,180,270}` (clockwise), `flip ∈ {"none","horizontal","vertical"}`.

- [ ] **Step 1: Write the failing test** `api/tests/test_rotate_service.py`

```python
from pathlib import Path

import pyvips
import pytest

from app.services.rotate import RotateError, rotate_image


def _png(path: Path, w=40, h=20) -> Path:
    pyvips.Image.black(w, h).add(100).cast("uchar").write_to_file(str(path))
    return path


def test_rotate_90_swaps_dimensions(tmp_path):
    src = _png(tmp_path / "in.png", 40, 20)
    dst = tmp_path / "out.png"
    rotate_image(src, dst, rotation=90, flip="none")
    out = pyvips.Image.new_from_file(str(dst))
    assert (out.width, out.height) == (20, 40)


def test_rotate_180_keeps_dimensions(tmp_path):
    src = _png(tmp_path / "in.png", 40, 20)
    dst = tmp_path / "out.png"
    rotate_image(src, dst, rotation=180, flip="horizontal")
    out = pyvips.Image.new_from_file(str(dst))
    assert (out.width, out.height) == (40, 20)


def test_rotate_bad_angle_raises(tmp_path):
    src = _png(tmp_path / "in.png")
    with pytest.raises(RotateError):
        rotate_image(src, tmp_path / "o.png", rotation=45, flip="none")
```

- [ ] **Step 2: Run to verify failure**

Run: `uv run pytest tests/test_rotate_service.py -v`
Expected: FAIL (`ModuleNotFoundError`).

- [ ] **Step 3: Write `api/app/services/rotate.py`**

```python
"""Rotate (multiples of 90°) and/or flip an image."""

from __future__ import annotations

from pathlib import Path

import pyvips

from app.services import imaging

_ANGLES = {0: None, 90: pyvips.Angle.D90, 180: pyvips.Angle.D180, 270: pyvips.Angle.D270}
_FLIPS = {"none": None, "horizontal": pyvips.Direction.HORIZONTAL, "vertical": pyvips.Direction.VERTICAL}


class RotateError(Exception):
    """A rotate/flip failed for a reason worth showing the user."""


def rotate_image(src: Path, dst: Path, *, rotation: int, flip: str) -> None:
    if rotation not in _ANGLES:
        raise RotateError("Rotation must be 0, 90, 180, or 270 degrees.")
    if flip not in _FLIPS:
        raise RotateError("Flip must be none, horizontal, or vertical.")
    try:
        image = imaging.load(src)
    except imaging.ImageError as exc:
        raise RotateError(str(exc)) from exc

    angle = _ANGLES[rotation]
    if angle is not None:
        image = image.rot(angle)
    direction = _FLIPS[flip]
    if direction is not None:
        image = image.flip(direction)
    try:
        imaging.save(image, dst)
    except imaging.ImageError as exc:
        raise RotateError(str(exc)) from exc
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `uv run pytest tests/test_rotate_service.py -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/services/rotate.py tests/test_rotate_service.py
git commit -m "feat(api): add rotate/flip service"
```

---

### Task 12: Crop service — NEW

**Files:**
- Create: `api/app/services/crop.py`
- Test: `api/tests/test_crop_service.py`

**Interfaces:**
- Consumes: `imaging.load`, `imaging.save`, `imaging.ImageError`.
- Produces: `CropError(Exception)`; `ASPECT_RATIOS: dict[str, tuple[int, int]]` (`{"1:1":(1,1),"4:3":(4,3),"16:9":(16,9),"9:16":(9,16)}`); `crop_image(src, dst, *, mode, aspect=None, rect=None) -> None`. `mode ∈ {"aspect","rect"}`; `rect` is `{"x","y","width","height"}` in pixels.

- [ ] **Step 1: Write the failing test** `api/tests/test_crop_service.py`

```python
from pathlib import Path

import pyvips
import pytest

from app.services.crop import CropError, crop_image


def _png(path: Path, w=400, h=200) -> Path:
    pyvips.Image.black(w, h).add(70).cast("uchar").write_to_file(str(path))
    return path


def test_crop_aspect_square_centers(tmp_path):
    src = _png(tmp_path / "in.png", 400, 200)
    dst = tmp_path / "out.png"
    crop_image(src, dst, mode="aspect", aspect="1:1")
    out = pyvips.Image.new_from_file(str(dst))
    assert out.width == out.height == 200  # largest centred square of a 400x200


def test_crop_rect_exact_box(tmp_path):
    src = _png(tmp_path / "in.png", 400, 200)
    dst = tmp_path / "out.png"
    crop_image(src, dst, mode="rect", rect={"x": 10, "y": 20, "width": 100, "height": 50})
    out = pyvips.Image.new_from_file(str(dst))
    assert (out.width, out.height) == (100, 50)


def test_crop_rect_out_of_bounds_raises(tmp_path):
    src = _png(tmp_path / "in.png", 400, 200)
    with pytest.raises(CropError):
        crop_image(src, tmp_path / "o.png", mode="rect",
                   rect={"x": 380, "y": 0, "width": 100, "height": 50})
```

- [ ] **Step 2: Run to verify failure**

Run: `uv run pytest tests/test_crop_service.py -v`
Expected: FAIL (`ModuleNotFoundError`).

- [ ] **Step 3: Write `api/app/services/crop.py`**

```python
"""Crop an image to an aspect-ratio (centred) or an exact pixel rectangle."""

from __future__ import annotations

from pathlib import Path

from app.services import imaging

ASPECT_RATIOS: dict[str, tuple[int, int]] = {
    "1:1": (1, 1),
    "4:3": (4, 3),
    "16:9": (16, 9),
    "9:16": (9, 16),
}


class CropError(Exception):
    """A crop failed for a reason worth showing the user."""


def _centered_box(w: int, h: int, ratio_w: int, ratio_h: int) -> tuple[int, int, int, int]:
    """Largest rectangle of ratio_w:ratio_h that fits in w×h, centred."""
    if w * ratio_h >= h * ratio_w:
        crop_h = h
        crop_w = round(h * ratio_w / ratio_h)
    else:
        crop_w = w
        crop_h = round(w * ratio_h / ratio_w)
    left = (w - crop_w) // 2
    top = (h - crop_h) // 2
    return left, top, crop_w, crop_h


def crop_image(src: Path, dst: Path, *, mode: str, aspect: str | None = None, rect: dict | None = None) -> None:
    try:
        image = imaging.load(src)
    except imaging.ImageError as exc:
        raise CropError(str(exc)) from exc

    if mode == "aspect":
        ratio = ASPECT_RATIOS.get(aspect or "")
        if ratio is None:
            raise CropError("Unknown aspect ratio.")
        left, top, box_w, box_h = _centered_box(image.width, image.height, *ratio)
    elif mode == "rect":
        if not rect:
            raise CropError("A crop rectangle is required.")
        left, top = int(rect["x"]), int(rect["y"])
        box_w, box_h = int(rect["width"]), int(rect["height"])
        if left < 0 or top < 0 or box_w <= 0 or box_h <= 0 or left + box_w > image.width or top + box_h > image.height:
            raise CropError("The crop rectangle is outside the image.")
    else:
        raise CropError("Unknown crop mode.")

    cropped = image.crop(left, top, box_w, box_h)
    try:
        imaging.save(cropped, dst)
    except imaging.ImageError as exc:
        raise CropError(str(exc)) from exc
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `uv run pytest tests/test_crop_service.py -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/services/crop.py tests/test_crop_service.py
git commit -m "feat(api): add crop service"
```

---

### Task 13: Worker dispatch — NEW

**Files:**
- Create: `api/app/jobs/worker.py`
- Test: `api/tests/test_worker.py`

**Interfaces:**
- Consumes: `JobRegistry`, `JobRecord`, `JobStatus`; `CounterStore`; the five services; `imaging.MEDIA_TYPES`, `imaging.ENCODE_TARGETS`.
- Produces: `run_job(record: JobRecord) -> None`; `async execute_job(registry, job_id, counter=None) -> None`. Params each runner expects (set by the router in Task 15):
  - convert: `{"names": [...], "target": str, "quality": int|None}`
  - compress: `{"names": [...], "quality": int}`
  - resize: `{"names": [...], "mode": str, "width": int|None, "height": int|None, "lock_aspect": bool, "percent": float|None, "preset": str|None}`
  - rotate: `{"names": [...], "rotation": int, "flip": str}`
  - crop: `{"names": [...], "mode": str, "aspect": str|None, "rect": dict|None}`
  - Input files are at `workspace/input-{i}{ext}`; the router stores each input's original extension in `params["exts"]` (list, parallel to names).

- [ ] **Step 1: Write the failing test** `api/tests/test_worker.py`

```python
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
```

- [ ] **Step 2: Run to verify failure**

Run: `uv run pytest tests/test_worker.py -v`
Expected: FAIL (`ModuleNotFoundError: app.jobs.worker`).

- [ ] **Step 3: Write `api/app/jobs/worker.py`**

```python
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


def _finish(record: JobRecord, outputs: list[tuple[Path, str]], media_type: str, zip_name: str) -> None:
    """One image → return it; many → zip them under their download names."""
    if len(outputs) == 1:
        record.result_path, record.download_name = outputs[0]
        record.media_type = media_type
        return
    archive = record.workspace / zip_name
    with zipfile.ZipFile(archive, "w", zipfile.ZIP_DEFLATED) as zf:
        for path, arcname in outputs:
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
    media_type = imaging.MEDIA_TYPES.get(exts[0].lstrip(".").replace("jpg", "jpeg"), "application/octet-stream")
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `uv run pytest tests/test_worker.py -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/jobs/worker.py tests/test_worker.py
git commit -m "feat(api): add worker dispatch for the five image tools"
```

---

### Task 14: Jobs router (reuse)

**Files:**
- Create: `api/app/routers/jobs.py` (copy verbatim from `../chowbea-pdf/api/app/routers/jobs.py`)
- Test: `api/tests/test_job_endpoints.py` (copy from `../chowbea-pdf/api/tests/test_job_endpoints.py`, adapt tool names)

**Interfaces:**
- Consumes: `JobRegistry`, `JobRecord`, `JobStatus`, schemas, `settings`.
- Produces: router with `GET /jobs/{id}`, `GET /jobs/{id}/download`, `GET /queue`.

- [ ] **Step 1: Copy the files**

```bash
cp ../chowbea-pdf/api/app/routers/jobs.py app/routers/jobs.py
cp ../chowbea-pdf/api/tests/test_job_endpoints.py tests/test_job_endpoints.py
```

`app/routers/jobs.py` is tool-agnostic — no edits. In `tests/test_job_endpoints.py`, if any fixture creates a record with `tool="compress"`/`"unlock"`, those tool names are still valid strings for status/download tests (the jobs router never dispatches), so the copied tests pass unchanged. Only change a tool literal if a test asserts on a PDF-specific value.

- [ ] **Step 2: Run the tests**

Run: `uv run pytest tests/test_job_endpoints.py -v`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add app/routers/jobs.py tests/test_job_endpoints.py
git commit -m "feat(api): add jobs router (reused from chowbea-pdf)"
```

---

### Task 15: Images router (submission endpoints) — NEW

**Files:**
- Create: `api/app/routers/images.py`
- Test: `api/tests/test_submit_endpoints.py`

**Interfaces:**
- Consumes: `settings`, `QueueUnavailableError`, `JobAccepted`, `imaging.ENCODE_TARGETS`, `resize.WIDTH_PRESETS`, `crop.ASPECT_RATIOS`.
- Produces: router (prefix `/img`) with `POST /img/{convert,compress,resize,rotate,crop}`, each `202 → JobAccepted`. Stores each job's inputs as `input-{i}{ext}` and sets `params["names"]` + `params["exts"]` for the worker.

- [ ] **Step 1: Write the failing tests** `api/tests/test_submit_endpoints.py`

```python
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
```

- [ ] **Step 2: Run to verify failure**

Run: `uv run pytest tests/test_submit_endpoints.py -v`
Expected: FAIL (`ModuleNotFoundError: app.routers.images`).

- [ ] **Step 3: Write `api/app/routers/images.py`**

```python
"""Routes for image actions. Submissions are queued, not processed inline."""

from __future__ import annotations

import json
import shutil
import tempfile
from pathlib import Path
from typing import Any, List

from fastapi import APIRouter, File, Form, HTTPException, Request, UploadFile

from app.core.config import settings
from app.jobs.schemas import JobAccepted
from app.services import imaging
from app.services.crop import ASPECT_RATIOS
from app.services.resize import WIDTH_PRESETS

router = APIRouter(prefix="/img", tags=["images"])

_MAX_UPLOAD_BYTES = settings.max_upload_mb * 1024 * 1024
_CHUNK_SIZE = 1024 * 1024

# Extension -> input kind. Decoders libvips can read; BMP/GIF are input-only.
_SOURCE_EXTS = {
    ".png": "png", ".jpg": "jpeg", ".jpeg": "jpeg", ".webp": "webp",
    ".avif": "avif", ".heic": "heif", ".heif": "heif",
    ".gif": "gif", ".tif": "tiff", ".tiff": "tiff", ".bmp": "bmp",
}

# Leading magic bytes per kind. HEIF/AVIF carry an 'ftyp' box at offset 4, so we
# match that box rather than a byte-0 prefix.
_MAGIC_PREFIXES = {
    "png": (b"\x89PNG\r\n\x1a\n",),
    "jpeg": (b"\xff\xd8\xff",),
    "webp": (b"RIFF",),
    "gif": (b"GIF87a", "GIF89a".encode()),
    "tiff": (b"II*\x00", b"MM\x00*"),
    "bmp": (b"BM",),
}
_FTYP_KINDS = {"heif", "avif"}


def _ext_and_kind(filename: str | None) -> tuple[str, str]:
    ext = Path(filename or "").suffix.lower()
    kind = _SOURCE_EXTS.get(ext)
    if kind is None:
        raise HTTPException(status_code=400, detail=f"Unsupported file type '{ext or filename}'.")
    return ext, kind


def _validate_head(head: bytes, kind: str, filename: str) -> None:
    mismatch = HTTPException(status_code=400, detail=f"'{filename}' does not look like a {kind} image.")
    if kind in _FTYP_KINDS:
        if len(head) < 12 or head[4:8] != b"ftyp":
            raise mismatch
        return
    prefixes = _MAGIC_PREFIXES.get(kind)
    if prefixes and not any(head.startswith(p) for p in prefixes):
        raise mismatch


async def _stream_to_disk(file: UploadFile, dest: Path, kind: str) -> None:
    size = 0
    first = True
    with dest.open("wb") as out:
        while True:
            chunk = await file.read(_CHUNK_SIZE)
            if not chunk:
                break
            if first:
                _validate_head(chunk, kind, file.filename or dest.name)
                first = False
            size += len(chunk)
            if size > _MAX_UPLOAD_BYTES:
                raise HTTPException(status_code=413, detail=f"'{file.filename}' exceeds the {settings.max_upload_mb} MB limit.")
            out.write(chunk)
    if size == 0:
        raise HTTPException(status_code=400, detail=f"'{file.filename}' is empty.")


def _safe_name(filename: str | None, fallback: str) -> str:
    return Path(filename or fallback).name or fallback


async def _store_uploads(files: list[UploadFile], work_dir: Path) -> tuple[list[str], list[str], int]:
    """Validate + stream each upload to input-{i}{ext}; return names, exts, total bytes."""
    names: list[str] = []
    exts: list[str] = []
    total = 0
    for i, file in enumerate(files):
        ext, kind = _ext_and_kind(file.filename)
        dest = work_dir / f"input-{i}{ext}"
        await _stream_to_disk(file, dest, kind)
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


async def _intake(request: Request, files: list[UploadFile], tool: str, prefix: str, extra: dict[str, Any]) -> JobAccepted:
    """Shared: make a workspace, store uploads, merge params, accept the job."""
    if not files:
        raise HTTPException(status_code=400, detail="No files were uploaded.")
    work_dir = Path(tempfile.mkdtemp(prefix=prefix))
    try:
        names, exts, total = await _store_uploads(files, work_dir)
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `uv run pytest tests/test_submit_endpoints.py -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/routers/images.py tests/test_submit_endpoints.py
git commit -m "feat(api): add image submission endpoints with per-format validation"
```

---

### Task 16: App entrypoint + lifespan (reuse, adapt)

**Files:**
- Create: `api/app/main.py` (copy from `../chowbea-pdf/api/app/main.py`, adapt imports/router/headers)
- Test: `api/tests/test_lifespan.py` (copy from `../chowbea-pdf/api/tests/test_lifespan.py`, adapt)

**Interfaces:**
- Consumes: `settings`, `JobQueue`, `JobRegistry`, `CounterStore`, `execute_job`, routers `images` + `jobs`.
- Produces: `app` (FastAPI) with lifespan wiring the queue consumer, sweep loop, and counter; `GET /health`; CORS; both routers mounted.

- [ ] **Step 1: Copy and adapt `app/main.py`**

```bash
cp ../chowbea-pdf/api/app/main.py app/main.py
```

Apply these edits to `app/main.py`:
- Change the router import from `from app.routers import jobs, pdf` to `from app.routers import images, jobs`.
- Change `app.include_router(pdf.router)` to `app.include_router(images.router)`.
- In the `CORSMiddleware` config, replace the PDF-specific `expose_headers=["X-Original-Size", "X-Compressed-Size", "Content-Disposition"]` with `expose_headers=["Content-Disposition"]`.
- Leave the `lifespan`, `_run_queue`, `_sweep_forever`, `handle`, and `/health` code unchanged (they are tool-agnostic and already import `execute_job` from `app.jobs.worker`).

- [ ] **Step 2: Copy and adapt the lifespan test**

```bash
cp ../chowbea-pdf/api/tests/test_lifespan.py tests/test_lifespan.py
```

In `tests/test_lifespan.py`, if the test posts to a PDF route to exercise the "broker down → 503" path, change that call to `POST /img/convert` with a small PNG and `data={"target": "jpeg"}`. If it only drives lifespan startup/shutdown (no route call), no edit is needed.

- [ ] **Step 3: Run the test**

Run: `uv run pytest tests/test_lifespan.py -v`
Expected: PASS. (The lifespan retries the broker forever in the background; the test asserts the app starts and serves without a live RabbitMQ.)

- [ ] **Step 4: Commit**

```bash
git add app/main.py tests/test_lifespan.py
git commit -m "feat(api): add app entrypoint + lifespan (adapted from chowbea-pdf)"
```

---

### Task 17: Full-suite green + OpenAPI export (handoff to the frontend plan)

**Files:**
- Create: `api/.env.example`
- Create: `api/data/.gitkeep`

**Interfaces:**
- Produces: a passing suite and an `openapi.json` the frontend plan will codegen against.

- [ ] **Step 1: Write `api/.env.example`**

```
# RabbitMQ broker URL.
CHOWBEA_RABBITMQ_URL=amqp://guest:guest@localhost:5672/
# Comma-separated browser origins allowed to call the API.
CHOWBEA_CORS_ORIGINS=http://localhost:3000
# Directory for the durable jobs counter (mount a volume here in prod).
CHOWBEA_DATA_DIR=./data
```

- [ ] **Step 2: Keep the data dir in git**

```bash
mkdir -p data && touch data/.gitkeep
```

- [ ] **Step 3: Run the whole suite**

Run: `uv run pytest -v`
Expected: PASS — every test from Tasks 1–16, no failures.

- [ ] **Step 4: Boot the app and export the spec**

Run (needs a broker for full submit, but `/openapi.json` and `/docs` render without one):

```bash
uv run uvicorn app.main:app --port 8000 &
sleep 2
curl -s http://localhost:8000/openapi.json -o /tmp/chowbea-img-openapi.json
curl -s http://localhost:8000/health
kill %1
```

Expected: `/health` returns `{"status":"ok","commit":"dev"}`; `/tmp/chowbea-img-openapi.json` lists paths `/img/convert`, `/img/compress`, `/img/resize`, `/img/rotate`, `/img/crop`, `/jobs/{job_id}`, `/jobs/{job_id}/download`, `/queue`, `/health`.

- [ ] **Step 5: Manual end-to-end smoke (optional, needs RabbitMQ)**

Start a broker (`docker run -d --name chowbea-rabbit -p 5672:5672 -p 15672:15672 rabbitmq:4-management`), restart the app, then:

```bash
curl -s -X POST http://localhost:8000/img/convert \
  -F files=@/path/to/photo.heic -F target=jpeg -F quality=82
# → 202 {"job_id": "...", ...}; poll /jobs/{id}; GET /jobs/{id}/download
```

Expected: a JPEG downloads; its EXIF `Software` reads `Chowbea Image (img.chowbea.com)`; no GPS tags survive.

- [ ] **Step 6: Commit**

```bash
git add api/.env.example api/data/.gitkeep
git commit -m "chore(api): add env example and data dir; backend complete"
```

---

## Self-Review

**1. Spec coverage:**
- Convert/Compress/Resize/Rotate/Crop services → Tasks 8–12. ✓
- Queue/registry/stats/jobs-router/counter/board reuse → Tasks 3–6, 14. ✓
- Job model (202 → poll → download; single vs ZIP) → worker `_finish` (Task 13) + jobs router (Task 14). ✓
- libvips + metadata policy (strip inherited, keep orientation, stamp attribution in EXIF+XMP) → Task 7. ✓
- Security: magic bytes (Task 15 `_validate_head`), size cap (Task 15 `_stream_to_disk`), decompression-bomb megapixel guard (Task 7 `load`). ✓
- Config/env with `CHOWBEA_` prefix, `img-jobs` queue → Tasks 2, 6. ✓
- Format matrix incl. BMP/GIF input-only, encode targets png/jpeg/webp/avif/tiff → Task 7 `ENCODE_TARGETS`, Task 15 `_SOURCE_EXTS`. ✓
- OpenAPI export for the frontend plan → Task 17. ✓
- Deploy (Dockerfile/CI/Railway/k8s) → **out of scope for this plan; it's Plan 3.** Noted, not a gap.

**2. Placeholder scan:** No TBD/TODO; every code step contains real code; reused files are `cp` from named, readable sources with explicit edits. ✓

**3. Type consistency:** `imaging.load/save`, `ENCODE_TARGETS`, `MEDIA_TYPES`, `ImageError`/`TooManyPixelsError` (Task 7) are consumed with matching names in Tasks 8–13 and 15. Service signatures declared in each task's Interfaces block match their call sites in the worker (Task 13). `params` keys set by the router (Task 15: `names`, `exts`, plus per-tool extras) match what each `_run_*` reads (Task 13). ✓

---

## Execution Handoff

Filled in by the writing-plans skill at the end of the conversation turn.
