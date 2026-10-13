# Slim Python base with the uv binary copied in from the official image.
FROM python:3.12-slim

# Bring in uv (and uvx) without a separate install step.
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

# libvips powers every image operation (convert/compress/resize/rotate/crop).
# libvips-tools brings the `vips` CLI for debugging. pyvips loads libvips at
# runtime (ABI mode), so the runtime lib is all that's needed.
#
# ghostscript (`gs`) distills oversized PDFs down to a portal's byte limit
# for the upload-fixer. libreoffice-writer converts DOC/DOCX/ODT to PDF
# when a portal accepts PDF. The API process is also the worker, so this
# image is what runs fix jobs. Locally:
#   sudo apt-get install ghostscript libreoffice-writer
#   brew install ghostscript && brew install --cask libreoffice
#
# Debian's libheif ships WITHOUT the AV1/HEVC codecs, so HEIC/AVIF would fail;
# the codec plugins add them: aomenc = AVIF encode, dav1d = AVIF decode,
# libde265 = HEIC decode (the "HEIC -> JPG" input path). HEIC *encode* is not a
# convert target, so libheif-plugin-x265 is intentionally omitted.
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        libvips42 \
        libvips-tools \
        libheif-plugin-aomenc \
        libheif-plugin-dav1d \
        libheif-plugin-libde265 \
        ghostscript \
        libreoffice-writer \
        fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Use the image's system Python, compile bytecode, and copy (not symlink) packages.
ENV UV_PYTHON_DOWNLOADS=0 \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy

# Install dependencies in their own cached layer, before app code, for fast rebuilds.
# Railway's builder requires cache mounts to carry an id of the form
# s/<service-id>-<path>; the chowbea-image api service id is baked in below.
COPY pyproject.toml uv.lock ./
RUN --mount=type=cache,id=s/adc60650-0630-4fd6-bd02-6e9683460a08-/root/.cache/uv,target=/root/.cache/uv \
    uv sync --locked

COPY app ./app

# Put the project's virtualenv on PATH so `uvicorn` runs directly.
ENV PATH="/app/.venv/bin:$PATH"
ENV PORT=8000
EXPOSE 8000

# Bind to all interfaces so the container is reachable by the platform router.
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT}"]
