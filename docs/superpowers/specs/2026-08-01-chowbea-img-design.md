# Chowbea Image — Design

Status: approved for planning · Date: 2026-08-01

## Purpose

Chowbea Image is a small monorepo providing free, ad-free tools for the simple
but painful image transformations people reach for constantly: converting
between formats (especially the "HEIC won't open on my laptop" case), shrinking
file size, and resizing/cropping/rotating. It is the sibling of
[chowbea-pdf](../../../chowbea-pdf) and is an intentional architectural twin of
it — the two apps stay easy to maintain as a pair by sharing the same backend
shape, job-queue machinery, API-client codegen, deployment story, and visual
design language. Only the tool set and the interface differ.

Target: **img.chowbea.com** (pdf.chowbea.com is the existing sibling).

## Scope

### v1 tools (5)

All five are fast, CPU-light operations and all are batch-capable.

| Tool | Does | Batch behavior |
|------|------|----------------|
| **Convert** | format → format | uniform target for all files (multiple files allowed) |
| **Compress** | shrink file size, keep each file's own format | uniform quality |
| **Resize** | to pixels (W×H, optional aspect lock), percent, or a width preset | uniform |
| **Rotate/Flip** | rotate 90/180/270, flip horizontal/vertical | uniform |
| **Crop** | aspect-ratio presets (center-crop) **or** freeform rectangle | presets → whole batch; freeform → single previewed image |

Only **Convert** changes the file format. Compress/Resize/Rotate/Crop keep each
input's original format.

**Format matrix**

- Decode (inputs): PNG, JPEG, WebP, AVIF, HEIC/HEIF, GIF, TIFF, BMP.
- Encode (Convert targets): PNG, JPEG, WebP, AVIF, TIFF, BMP.
- GIF and animated formats: v1 treats them as single-frame (flatten to the first
  frame). Animated output is a non-goal.

### Non-goals (v1)

- AI operations: background removal, upscaling. (Deferred; these are the only
  ops heavy enough to have justified a different architecture.)
- Live client-side compression preview / before-after quality slider. v1 shows
  the result (and its size) after the job runs.
- Animated GIF/APNG/animated-WebP frame preservation.
- RAW camera formats (CR2, NEF, …), SVG rasterization.
- Image → PDF. That belongs to chowbea-pdf; a future cross-app bridge is
  possible but out of scope here.

## Architecture

An exact mirror of chowbea-pdf: one monorepo, two independently deployable apps,
a RabbitMQ-backed job queue processed a few at a time, with a public queue board.

```
┌──────────────┐  submit (202 + job id)  ┌──────────────┐   publish   ┌──────────┐
│ web          │ ───────────────────────▶│ api          │ ───────────▶│ RabbitMQ │
│ TanStack     │  poll /jobs/{id}        │ FastAPI      │◀─────────── │ img-jobs │
│ Start + bun  │◀─────────────────────── │ + worker     │  consume ×3 └──────────┘
└──────────────┘  download when done     │ (libvips /   │
                                         │  pyvips)     │
                                         └──────────────┘
```

Rationale for keeping the full queue (decided with the user, YAGNI flagged and
overridden): maximum consistency with the PDF app, and real batch backpressure
for the "convert these 40 HEICs at once" case — which is also exactly where the
libvips compute choice pays off.

**Key invariant (carried from the PDF app):** only the job id crosses the
broker. Uploaded files stay on local disk; job params stay in the in-process
registry. A large upload never has to survive a trip through AMQP.

**Single-replica assumption (carried over):** the `JobRegistry` is in-process
and is the source of truth for queue order/position, so the API runs as one
uvicorn process / one replica. This is the known scaling ceiling and is
acceptable for the traffic profile.

### Monorepo layout

```
chowbea-img/
  api/            FastAPI backend (uv, Python ≥3.12), libvips via pyvips
  web/            TanStack Start frontend (React 19, Vite, Tailwind v4, bun)
  k8s/            optional local kind/nginx manifests (mirror PDF if wanted)
  docs/           superpowers specs + plans
  .github/workflows/ci.yml
  Makefile  README.md  purpose.md
```

## Backend design

### App layout (mirrors chowbea-pdf/api/app)

```
app/
  main.py                 FastAPI app + lifespan (queue consumer, sweep, counter)
  core/config.py          Settings (env, CHOWBEA_ prefix)
  jobs/
    queue.py              JobQueue: robust connection + durable "img-jobs" queue
    registry.py           JobRegistry + JobRecord + JobStatus  (verbatim from PDF)
    schemas.py            JobAccepted, JobStatusResponse, BoardEntry, QueueBoard
    worker.py             execute_job + per-tool _run_* dispatch
    stats.py              CounterStore (durable jobs-completed counter)  (verbatim)
  routers/
    images.py             POST /img/{tool} submission endpoints
    jobs.py               GET /jobs/{id}, /jobs/{id}/download, GET /queue  (verbatim)
  services/
    convert.py  compress.py  resize.py  rotate.py  crop.py
    imaging.py            shared libvips load/save helpers + metadata policy
```

`jobs/registry.py`, `jobs/stats.py`, `jobs/queue.py` (bar the queue name),
`routers/jobs.py`, and `main.py`'s lifespan/sweep/consumer wiring are lifted
almost verbatim from chowbea-pdf. `s/pdf-jobs/img-jobs/`, `s/tool set/`.

### Endpoints

Every submission returns `202` + `JobAccepted {job_id, position, queue_size}`,
identical to the PDF app. Result retrieval is the shared
`GET /jobs/{id}` (poll) → `GET /jobs/{id}/download` flow. One image in → the
image back; multiple → a ZIP.

| Method + path | Form fields |
|---|---|
| `POST /img/convert` | `files[]` (1+), `target` (png/jpeg/webp/avif/tiff/bmp), `quality?` (1–100, lossy targets only) |
| `POST /img/compress` | `files[]` (1+), `quality` (1–100) |
| `POST /img/resize` | `files[]` (1+), `mode` (dimensions/percent/preset), `width?`, `height?`, `lock_aspect?`, `percent?`, `preset?` |
| `POST /img/rotate` | `files[]` (1+), `rotation` (0/90/180/270), `flip` (none/horizontal/vertical) |
| `POST /img/crop` | `files[]` (1+ for aspect; exactly 1 for rect), `mode` (aspect/rect), `aspect?` (1:1/4:3/16:9/9:16), `rect?` (JSON `{x,y,width,height}` px) |

Shared meta endpoints: `GET /health`, plus the reused `GET /jobs/{id}`,
`GET /jobs/{id}/download`, `GET /queue`.

### Service modules

Each tool is one synchronous service function operating on files in the job
workspace, dispatched onto a worker thread by `execute_job` (same pattern as the
PDF worker). Each raises a tool-specific `*Error` for user-facing failures; the
worker maps known errors to the job's `error` field and anything else to a
generic message.

- **convert** — decode input, encode to `target` at `quality` (lossy targets).
- **compress** — re-encode in the same format at `quality`. Per-format mapping:
  JPEG/WebP/AVIF use the quality parameter directly; PNG uses palette
  quantisation + max deflate (libvips `pngsave` with palette). Lossless-in →
  smaller-out without a format change.
- **resize** — dimensions (with optional aspect lock), percent, or a named width
  preset; never upscales past 100% unless dimensions explicitly ask for it.
- **rotate** — multiple-of-90 rotation and/or a flip.
- **crop** — `aspect`: center-crop each file to the largest centered rectangle of
  the target ratio (batch-uniform). `rect`: exact pixel box on a single file.

### Imaging (libvips / pyvips)

`services/imaging.py` centralizes load + save so the metadata policy and
decompression-bomb guard live in exactly one place:

- **Load:** `pyvips.Image.new_from_file(..., access="sequential")` for
  streaming; apply `autorot()` so orientation is baked into pixels and phone
  photos are never sideways.
- **Decompression-bomb guard:** before doing work, reject images whose
  `width * height` exceeds `settings.max_image_megapixels` (default 300 MP).
  libvips is header-lazy, so the dimension check is cheap and happens before any
  full decode.
- **Metadata policy on save:** strip all inherited metadata, then set our own
  attribution in **both**:
  - EXIF: `Software = "Chowbea Image (img.chowbea.com)"`
  - XMP: an `xmp:CreatorTool` / equivalent note "edited with Chowbea".
  Saved with libvips `keep` flags limited to the fields we set, so nothing from
  the source (GPS, camera, timestamps) leaks. Attribution is always-on (not a
  toggle) — a harmless attribution fact for a free tool.

Docker installs the `libvips` system library (the Ghostscript/LibreOffice
pattern already used by the PDF app); `pyvips` comes via pip/uv. CI installs
libvips the same way.

### Validation & security (deliberately not simplified)

Mirrors the PDF app's upload hardening, adapted to images:

- **Magic-byte validation** per declared kind while streaming the upload to disk
  (PNG `\x89PNG`, JPEG `\xff\xd8\xff`, GIF `GIF8`, BMP `BM`, TIFF `II*\0`/`MM\0*`,
  RIFF/WEBP, and the HEIF/AVIF `ftyp` box). Reject on mismatch.
- **Size cap:** stream in 1 MB chunks, enforce `settings.max_upload_mb`
  (default 100), reject empty uploads.
- **Pixel cap:** the megapixel guard above (bomb protection).
- Uploads land in a per-job `tempfile.mkdtemp` workspace; the registry's TTL
  sweep removes finished workspaces after `result_ttl_minutes` (30).

### Config (`core/config.py`, `CHOWBEA_` env prefix)

`app_name="Chowbea Image API"`, `app_version`, `cors_origins`,
`max_upload_mb=100`, `max_image_megapixels=300`, `rabbitmq_url`,
`result_ttl_minutes=30`, `job_concurrency=3`,
`commit_sha` (alias `RAILWAY_GIT_COMMIT_SHA`), `data_dir`. Queue name is
`img-jobs`.

## Frontend design

### Layout — gallery-first workspace

A single primary route `/` (plus the reused `/queue` board). Flow:

```
┌─ toolbar: Convert  Compress  Resize  Crop  Rotate ──────────────┐
│  ┌ gallery grid ─────────────┐   ┌ options + preview panel ───┐ │
│  │ [img][img][img][img]      │   │  active tool's options     │ │
│  │ [img][img][img][+ drop]   │   │  before | after preview    │ │
│  │  (select / deselect)      │   │  quality ─●─      [ Go ]    │ │
│  └───────────────────────────┘   └────────────────────────────┘ │
│  progress row (uploading → queued #pos → processing → done)      │
└──────────────────────────────────────────────────────────────────┘
```

- Drop a batch → thumbnail grid. Select all / a subset.
- Pick a tool from the toolbar → its option panel appears.
- **Go** submits one job (selected files + tool + params) through the shared
  submit→poll→download flow, showing the same queued/position/processing UI the
  PDF app uses.
- Result: single image downloads directly; multiple → ZIP (client-side rename of
  ZIP entries reused from the PDF app's `fflate` helper if needed).

### Preview strategy

- Thumbnails and before/after use client-side `object URL`s for
  browser-renderable formats (PNG/JPG/WebP/GIF/BMP, plus AVIF in modern
  browsers).
- HEIC and TIFF cannot render in browsers → show a filetype chip
  ("HEIC — preview after convert") instead of a broken image. The "after"
  preview uses the downloaded result blob once the job completes.

### State

One Zustand workspace store: dropped images (`id`, `File`, `name`, `size`,
`kind`, `objectUrl | null`, `previewable`, `selected`), the active tool,
per-tool option state, the selection set, and the current job progress. Simpler
than the PDF app's per-page + handoff stores because everything lives on one
page.

### Crop UX

- **Presets** (1:1, 4:3, 16:9, 9:16): a segmented control; applies a uniform
  center-crop to the whole selection → `mode=aspect`.
- **Freeform**: a draggable/resizable box overlaid on the single previewed
  image → `mode=rect` with pixel `{x,y,width,height}`; single-file only.

### API client & shared libs (reused from chowbea-pdf, adapted)

- `lib/jobs.ts` (submit→poll→download machinery, remembered-jobs, queue board):
  verbatim except the tool string union.
- `lib/api.ts`: per-tool wrappers (`convertImages`, `compressImages`,
  `resizeImages`, `rotateImages`, `cropImages`) plus `downloadBlob`,
  `formatBytes`.
- `services/api/*`: the `chowbea-axios` OpenAPI→typed-Axios codegen pipeline,
  regenerated from this API's spec (`bun api:generate` / `api:watch`).
- Reused UI: `dropzone`, `file-card`, `jobs-counter`, `tool-header`,
  `ui/{button,card,badge,progress,select,toggle-switch}`, `queue-toggle`,
  the `/queue` route, and `styles.css` design tokens.
- New UI: workspace grid, toolbar, per-tool option panels, crop overlay,
  before/after preview.

## Design system reuse

Same palette and type as chowbea-pdf — the "Bold Blocks" language: warm cream
background (`#FFF3E2` theme color), ink borders, block shadows, `press` button
treatment, Bricolage Grotesque (display) + Hanken Grotesk (body). The
`styles.css` token layer and `ui/` primitives are copied over unchanged; only
the page composition (gallery-first workspace vs the PDF app's per-tool pages)
differs. This satisfies "same color palette and design language, different
interface."

## Deployment

- **Docker per app.** `api/Dockerfile` installs the `libvips` system lib +
  `uv sync`; `web/Dockerfile` builds with bun. Same independent-image approach as
  the PDF app.
- **Railway.** Two services (api, web); merges to `main` auto-deploy the service
  whose files changed, once CI passes. Env: `CHOWBEA_RABBITMQ_URL`,
  `CHOWBEA_CORS_ORIGINS`, `CHOWBEA_DATA_DIR` (volume for the counter), etc.
- **CI** (`.github/workflows/ci.yml`) mirrors the PDF app: an `api` job
  (`apt-get install libvips`, `uv sync --locked`, `pytest`) and a `web` job
  (`bun install`, `bun run test`, `typecheck`, `build`). Railway waits on CI.
- **k8s/** manifests are optional and mirror the PDF app's local kind setup if
  desired; not required for Railway.

## Testing

- **api (pytest):** one service test per tool (convert/compress/resize/rotate/
  crop) asserting real libvips round-trips (e.g. a converted PNG→JPEG opens as
  JPEG; a resized image has the expected dimensions; crop-aspect yields the
  target ratio; metadata is stripped and the Chowbea `Software`/XMP marker is
  present; a >max-megapixel image is rejected). Plus reused job-endpoint,
  queue, registry, stats, and worker tests adapted from the PDF suite.
- **web (vitest + typecheck + build):** pure helpers (crop math, ZIP entry
  rename, byte formatting, job-flow status transitions), the workspace store,
  and component smoke tests. `bun run typecheck` gates the generated API client.

## Open questions / future

- Compress "quality" for PNG: v1 uses palette quantisation; revisit if users
  want strictly-lossless PNG optimization (oxipng-style) as a separate mode.
- A future chowbea.com hub linking pdf/img, and an image→PDF bridge between the
  two apps.
- AI background-removal / upscale as a later heavy-op tier (would reuse the queue
  it was originally built for).
