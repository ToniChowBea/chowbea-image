# Chowbea Image — Frontend (web) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. **UI tasks:** load `ui-ux-pro-max` (or `frontend-design`) before writing components, and use the reused chowbea-pdf/web files named in each task as the concrete reference.

**Goal:** Build `web/` — the gallery-first image workspace for Chowbea Image (React 19 / TanStack Start), consuming the live API, and deploy it as a `web` service on Railway alongside the api.

**Architecture:** A single-route TanStack Start SPA/SSR app. One Zustand "workspace" store holds dropped images, selection, the active tool, per-tool options, and job progress. Each tool submits one queued job through a shared submit→poll→download pipeline (`lib/jobs.ts` + `lib/api.ts`) against a `chowbea-axios`-generated typed client. Reuses chowbea-pdf/web's tooling, jobs pipeline, and "Bold Blocks" palette, **evolved** into a preview-forward creative-tool aesthetic.

**Tech Stack:** TanStack Start (React 19, Vite), Tailwind v4, shadcn, hugeicons, zustand, @dnd-kit (grid selection / crop drag), motion (transitions), fflate (client ZIP rename), chowbea-axios (typed client), bun. Deploy: Docker + Railway.

## Global Constraints

- **Reuse source:** chowbea-pdf/web at the ABSOLUTE path `/Users/oddspace/documents/projects/chowbea/chowbea-pdf/web`. "Adapt from pdf" means copy the named file and change it as described — the source is real and readable.
- **Live API:** `https://chowbea-image-production.up.railway.app`. Local dev API: `http://localhost:8000` (run the backend with `cd api && uv run uvicorn app.main:app --port 8000`). Client base URL comes from `VITE_API_URL`.
- **API surface (from OpenAPI):** `POST /img/{convert,compress,resize,rotate,crop}` → `202 JobAccepted {job_id, position, queue_size}`; `GET /jobs/{job_id}` → `JobStatusResponse {id,tool,status,position,queue_size,error,file_count,total_bytes,created_at}`; `GET /jobs/{job_id}/download` → the file (single) or ZIP (batch); `GET /queue` → `QueueBoard {concurrency,jobs_completed,processing[],waiting[]}`. `status ∈ queued|processing|done|failed`.
- **Tool params (multipart form fields, must match the api exactly):**
  - convert: `files[]`, `target` (png/jpeg/webp/avif/tiff), `quality?` (1–100)
  - compress: `files[]`, `quality` (1–100)
  - resize: `files[]`, `mode` (dimensions/percent/preset), `width?`, `height?`, `lock_aspect?` (bool), `percent?`, `preset?` (1920/1280/640)
  - rotate: `files[]`, `rotation` (0/90/180/270), `flip` (none/horizontal/vertical)
  - crop: `files[]` (1 for rect), `mode` (aspect/rect), `aspect?` (1:1/4:3/16:9/9:16), `rect?` (JSON `{x,y,width,height}` px)
- **Input formats accepted:** png, jpg/jpeg, webp, avif, heic/heif, gif, tif/tiff, bmp. Browser-renderable for `<img>`: png/jpg/webp/gif/bmp (+ avif in modern browsers); **heic/tiff are NOT browser-renderable → show a filetype placeholder** until processed.
- **Design system:** the "Bold Blocks" palette/tokens (cream `#fff3e2`, ink `#211a12`, amber `#f2922b`, hard offset shadows `--shadow-block*`/`--shadow-amber*` with NO blur, Bricolage Grotesque headings + Hanken Grotesk body, 14px radius). **Evolve** it for a preview-forward workspace (see Task 3) — do not just clone the PDF pages.
- **Package manager:** bun. Tests: `bun run test` (vitest). Gates: `bun run typecheck` and `bun run build` must pass.
- TDD on logic tasks (write failing test → run red → implement → green → commit). UI tasks: build → `typecheck` + `build` + component smoke test + a visual check via the running dev server; commit.
- All web commands run from `web/` unless stated. Small commits.

---

### Task 1: Scaffold the web app

**Files:** Create `web/` via TanStack Start scaffold; then `web/.env.example`, adjust `web/package.json`.
**Interfaces:** Produces a booting TanStack Start app (`bun run dev` on :3000) with Tailwind v4 + shadcn wired.

- [ ] **Step 1:** From `chowbea-img/`, scaffold with the same tool pdf used (create-tanstack-app, file-router, react, typescript, tailwind, eslint):
  `bunx create-tanstack-app@latest web --template file-router --tailwind --no-git` (accept defaults; if the CLI differs, mirror `chowbea-pdf/web/.cta.json` settings). Confirm `web/package.json`, `web/vite.config.ts`, `web/src/routes/__root.tsx` exist.
- [ ] **Step 2:** Add the runtime deps to `web/package.json` (match chowbea-pdf/web versions — read `/Users/oddspace/documents/projects/chowbea/chowbea-pdf/web/package.json`): `@base-ui/react`, `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`, `@fontsource-variable/{figtree,geist,geist-mono}`, `@hugeicons/core-free-icons`, `@hugeicons/react`, `@tailwindcss/vite`, `axios`, `class-variance-authority`, `clsx`, `fflate`, `motion`, `next-themes`, `tailwind-merge`, `tailwindcss`, `tw-animate-css`, `zustand`; dev deps: `chowbea-axios`, `@testing-library/{dom,react}`, `jsdom`, `vitest`, `prettier`, `prettier-plugin-tailwindcss`, `@types/*`. Do NOT add `pdfjs-dist` (pdf-only).
- [ ] **Step 3:** Write `web/.env.example`: `VITE_API_URL=http://localhost:8000`. Create `web/.env` with the same for local dev.
- [ ] **Step 4:** Add npm scripts mirroring pdf/web: `dev` (`vite dev --port 3000`), `build`, `start`, `test` (`vitest run`), `typecheck` (`tsc --noEmit`), `api:generate`/`api:watch` (`chowbea-axios ...`), `format`/`check`.
- [ ] **Step 5:** `bun install` then `bun run dev` — confirm the app serves on http://localhost:3000. Stop it.
- [ ] **Step 6: Commit** `git add web/ && git commit -m "chore(web): scaffold TanStack Start app"`.

---

### Task 2: Typed API client (chowbea-axios codegen)

**Files:** Create `web/api.config.toml`; generate `web/src/services/api/**`.
**Interfaces:** Produces the generated typed client + `services/api/api.instance.ts` reading `VITE_API_URL`.

- [ ] **Step 1:** Write `web/api.config.toml` adapted from `/Users/oddspace/documents/projects/chowbea/chowbea-pdf/web/api.config.toml`: `api_endpoint = "http://localhost:8000/openapi.json"`, `[output] folder = "src/services/api"`, `[instance] base_url_env = "VITE_API_URL"`, `env_accessor = "import.meta.env"`, `with_credentials = true`, `timeout = 60000`.
- [ ] **Step 2:** Start the backend locally (`cd ../api && uv run uvicorn app.main:app --port 8000 &`), then from `web/` run `bun run api:generate`. Confirm `src/services/api/_generated/*` and `api.instance.ts` are created with the 5 `/img/*` operations + jobs/queue.
- [ ] **Step 3:** `bun run typecheck` — passes.
- [ ] **Step 4: Commit** `git add web/api.config.toml web/src/services && git commit -m "feat(web): generate typed API client"`.

---

### Task 3: Evolved "Bold Blocks" design system + UI primitives

**Files:** Create `web/src/styles.css`; `web/src/components/ui/{button,card,badge,progress,select,toggle-switch,slider,segmented}.tsx`; `web/src/lib/utils.ts`; fonts.
**Interfaces:** Produces the token layer + reusable primitives every UI task consumes.
**Load `ui-ux-pro-max` first.** Reference: `/Users/oddspace/documents/projects/chowbea/chowbea-pdf/web/src/styles.css` and `.../src/components/ui/*`.

- [ ] **Step 1:** Copy pdf/web `src/styles.css` as the base token layer (cream/ink/amber, `--shadow-block*`/`--shadow-amber*`, Bricolage/Hanken fonts, radius scale — see Global Constraints).
- [ ] **Step 2:** **Evolve** it for the workspace (this is the "evolve the design" investment): keep the palette + hard-shadow language, but add tokens/utilities for a preview-forward creative tool — e.g. an image-card frame treatment (ink outline + hard shadow + amber selected-state ring), a canvas/checkerboard surface for transparency, a tactile toolbar, and motion-friendly transitions. Document the additions in a comment block. Keep it accessible (WCAG AA contrast; the amber-on-ink and ink-on-cream pairs already pass).
- [ ] **Step 3:** Port the shadcn primitives from pdf/web `ui/` (`button`, `card`, `badge`, `progress`, `select`, `toggle-switch`) verbatim-then-restyle to the evolved tokens; ADD `slider` (compress/quality + resize) and `segmented` (crop aspect / resize mode / tool toggles) using the same token system.
- [ ] **Step 4:** `lib/utils.ts` with `cn()` (clsx + tailwind-merge), copied from pdf/web.
- [ ] **Step 5:** Wire fonts (fontsource or the Google Fonts `<link>` pdf uses in `__root.tsx`) — Bricolage Grotesque + Hanken Grotesk.
- [ ] **Step 6:** `bun run typecheck` + `bun run build` pass. Render a scratch page showing each primitive; visually confirm the evolved look in the dev server. Delete the scratch page.
- [ ] **Step 7: Commit** `git commit -m "feat(web): evolved Bold Blocks tokens + UI primitives"`.

---

### Task 4: Job pipeline (submit → poll → download)

**Files:** Create `web/src/lib/jobs.ts`; Test: `web/src/lib/jobs.test.ts`.
**Interfaces:** Adapt from `/Users/oddspace/documents/projects/chowbea/chowbea-pdf/web/src/lib/jobs.ts` (near-verbatim — it is tool-agnostic). Produces `API_BASE_URL`, `JobState`, `JobAccepted`, `JobStatusResponse`, `QueueBoard`, `JobProgress`, `toApiError`, `fetchJobStatus`, `waitForJob`, `downloadJobResult`, `runJobFlow`, `fetchQueueBoard`, `rememberJob`, `recallJobIds`.

- [ ] **Step 1:** Copy pdf/web `src/lib/jobs.ts` and `src/lib/jobs.test.ts` verbatim (the module has no PDF-specific logic — it operates on `job_id`s and the shared endpoints). Confirm `API_BASE_URL` reads `import.meta.env.VITE_API_URL`.
- [ ] **Step 2:** Run `bun run test src/lib/jobs.test.ts` — passes. If a test references a pdf tool string, change it to an image tool (e.g. `"convert"`); do not weaken assertions.
- [ ] **Step 3: Commit** `git commit -m "feat(web): job submit/poll/download pipeline (reused)"`.

---

### Task 5: Per-tool API wrappers

**Files:** Create `web/src/lib/api.ts`; Test: `web/src/lib/api.test.ts`.
**Interfaces:** Consumes `lib/jobs.ts`. Produces `downloadBlob`, `formatBytes`, and the 5 wrappers, each returning `{blob, filename}`:
- `convertImages(files, target, quality|null, onProgress?)`
- `compressImages(files, quality, onProgress?)`
- `resizeImages(files, opts:{mode,width?,height?,lockAspect?,percent?,preset?}, onProgress?)`
- `rotateImages(files, {rotation, flip}, onProgress?)`
- `cropImages(files, {mode, aspect?, rect?}, onProgress?)`
Each builds a `FormData` with the exact field names from Global Constraints, submits via `runJobFlow`, and returns the downloaded blob + filename. Model closely on pdf/web `src/lib/api.ts` (read it — same submitForm/runJobFlow shape).

- [ ] **Step 1: Write failing tests** `src/lib/api.test.ts`: assert `formatBytes` (0→"0 B", 1536→"1.5 KB", etc.), and that each wrapper posts the right path + form fields (mock `runJobFlow`/axios; assert the FormData keys/values, e.g. convert sets `target` and `quality`; crop rect sets `rect` as JSON; resize percent sets `mode=percent`+`percent`). Run red.
- [ ] **Step 2: Implement** `src/lib/api.ts` per the interface above. `downloadBlob`/`formatBytes` copied from pdf/web `api.ts`.
- [ ] **Step 3:** `bun run test src/lib/api.test.ts` green; `bun run typecheck`.
- [ ] **Step 4: Commit** `git commit -m "feat(web): per-tool API wrappers"`.

---

### Task 6: Client image helpers + crop math

**Files:** Create `web/src/lib/images.ts`, `web/src/lib/crop.ts`, `web/src/lib/rename-zip.ts`; Tests alongside.
**Interfaces:**
- `images.ts`: `SUPPORTED_EXTS` set; `extOf(name)`; `isBrowserRenderable(name): boolean` (png/jpg/jpeg/webp/gif/bmp/avif → true; heic/heif/tif/tiff → false); `objectUrlFor(file): string`; `revokeUrl(url)`; `kindLabel(name)` (e.g. "HEIC").
- `crop.ts`: `centeredBox(w,h,ratioW,ratioH): {x,y,width,height}` (largest centered rect of the ratio — mirror the api's `_centered_box`); `clampRect(rect, w, h)`; `ASPECTS = {"1:1":[1,1],...}`.
- `rename-zip.ts`: `renameZipEntries(blob, names): Promise<Blob>` using fflate if needed (mirror pdf/web `rename-zip.ts` if present) — or `dedupeNames(names)` mirroring the api's `_dedupe_names` so client-suggested names match server output.

- [ ] **Step 1: Write failing tests**: `crop.test.ts` (centeredBox 400×200 @1:1 → {x:100,y:0,width:200,height:200}; @16:9 → width-limited; clampRect keeps within bounds), `images.test.ts` (isBrowserRenderable for heic=false, png=true; extOf; kindLabel), `rename-zip.test.ts` (dedupe `["a.png","a.png"]`→`["a.png","a-2.png"]`). Run red.
- [ ] **Step 2: Implement** the three modules. Reuse pdf/web equivalents where they exist (`rename-zip.ts`, `supported-files.ts`).
- [ ] **Step 3:** Tests green; `bun run typecheck`.
- [ ] **Step 4: Commit** `git commit -m "feat(web): image/crop/zip client helpers"`.

---

### Task 7: Workspace store (Zustand)

**Files:** Create `web/src/stores/workspace.ts`; Test: `web/src/stores/workspace.test.ts`.
**Interfaces:** Produces `useWorkspace` with state `{ images: WorkspaceImage[], selectedIds: Set<string>, activeTool: ToolName|null, options: {convert,compress,resize,rotate,crop}, progress: JobProgress|null, result: {blob,filename}|null, error: string|null }` and actions `addFiles(files)`, `removeImage(id)`, `clear()`, `toggleSelect(id)`, `selectAll()/selectNone()`, `setActiveTool(t)`, `setOption(tool, patch)`, `setProgress/ setResult/ setError`. `WorkspaceImage = {id, file, name, size, ext, previewable, url|null}`. `ToolName = "convert"|"compress"|"resize"|"rotate"|"crop"`. Default per-tool options match the api defaults (convert target=png quality=80; compress quality=70; resize mode=percent percent=100; rotate rotation=0 flip=none; crop mode=aspect aspect="1:1").

- [ ] **Step 1: Write failing tests**: addFiles creates WorkspaceImage entries (ext + previewable set via `images.ts`), toggleSelect/selectAll/selectNone update selection, setOption merges per-tool patch, removeImage revokes its object URL. Run red.
- [ ] **Step 2: Implement** the store. Object URLs created on add, revoked on remove/clear.
- [ ] **Step 3:** Tests green; `bun run typecheck`.
- [ ] **Step 4: Commit** `git commit -m "feat(web): workspace zustand store"`.

---

### Task 8: App shell + queue board route

**Files:** Modify `web/src/routes/__root.tsx`; Create `web/src/components/jobs-counter.tsx`, `web/src/routes/queue.tsx`, `web/src/lib/queue-toggle.ts`.
**Interfaces:** Produces the header/footer shell (brand, GitHub link, jobs counter, theme meta = `#fff3e2`, Bricolage/Hanken font `<link>`), the reused `/queue` board, and the jobs-counter component. Reference pdf/web `__root.tsx`, `components/jobs-counter.tsx`, `routes/queue.tsx`, `lib/queue-toggle.ts`.

- [ ] **Step 1:** Adapt `__root.tsx` from pdf/web: brand → "Chowbea Image", meta description for image tools, keep the Bold Blocks header/footer + jobs-counter, fonts. Point nav at `/` (workspace) and `/queue`.
- [ ] **Step 2:** Copy + adapt `jobs-counter.tsx`, `routes/queue.tsx` (uses `fetchQueueBoard`), `lib/queue-toggle.ts` (+ its test) — tool-agnostic, minor label edits.
- [ ] **Step 3:** `bun run typecheck` + `bun run build`; visually confirm the shell + `/queue` render in the dev server (against the live or local API).
- [ ] **Step 4: Commit** `git commit -m "feat(web): app shell + queue board"`.

---

### Task 9: Dropzone + image grid (gallery)

**Files:** Create `web/src/components/workspace/dropzone.tsx`, `image-card.tsx`, `image-grid.tsx`.
**Load `ui-ux-pro-max`.** Reference pdf/web `components/dropzone.tsx`, `file-card.tsx`.
**Interfaces:** `Dropzone` (drag-drop + click, accepts the supported exts, calls `addFiles`); `ImageGrid` renders `useWorkspace().images` as an ink-outlined card grid with hard shadows; `ImageCard` shows the thumbnail (`img.url` when previewable, else a filetype placeholder chip via `kindLabel`), name, size (`formatBytes`), a selected state (amber ring), a remove button, and a "+ drop more" affordance.

- [ ] **Step 1: Build** the three components using the evolved tokens (Task 3). Selection toggles via the store; drag-select is optional (nice-to-have). Empty state: a bold centered dropzone.
- [ ] **Step 2: Verify:** a component smoke test (renders grid from a seeded store with 2 images, asserts names shown + placeholder for a `.heic`); `bun run typecheck` + `build`; visually confirm dropping PNG/JPG/HEIC in the dev server (HEIC shows the placeholder).
- [ ] **Step 3: Commit** `git commit -m "feat(web): dropzone + image grid"`.

---

### Task 10: Toolbar + workspace layout

**Files:** Create `web/src/components/workspace/toolbar.tsx`, `workspace.tsx`; wire into `web/src/routes/index.tsx`.
**Load `ui-ux-pro-max`.**
**Interfaces:** `Toolbar` — 5 chunky tool buttons (Convert/Compress/Resize/Rotate/Crop with hugeicons), active state amber; sets `activeTool`. `Workspace` — the main layout: `ImageGrid` on one side, the active tool's option panel + preview on the other, a progress row, responsive (stacks on mobile). `routes/index.tsx` renders `Dropzone` (empty state) → `Workspace` (when images present).

- [ ] **Step 1: Build** the toolbar + responsive workspace layout using the evolved design (this is the app's centerpiece — invest here). Panel area shows a placeholder until a tool is selected.
- [ ] **Step 2: Verify:** typecheck + build; visually confirm the layout, tool switching, and responsiveness in the dev server.
- [ ] **Step 3: Commit** `git commit -m "feat(web): toolbar + workspace layout"`.

---

### Task 11: Convert + Compress option panels

**Files:** Create `web/src/components/workspace/panels/convert-panel.tsx`, `compress-panel.tsx`, and `web/src/components/workspace/go-bar.tsx`.
**Interfaces:** `ConvertPanel` — target format `segmented`/`select` (png/jpeg/webp/avif/tiff), a quality `slider` shown only for lossy targets (jpeg/webp/avif); reads/writes `options.convert`. `CompressPanel` — a quality `slider` (1–100) with a helper note. `GoBar` — the shared submit control (selected count, an amber "Go" button) that calls the active tool's `lib/api.ts` wrapper with the selected files + options, threads `onProgress` into the store, and on success stores `{blob,filename}`.

- [ ] **Step 1: Build** both panels + the GoBar. GoBar disabled when no images selected. Convert quality hidden for png/tiff (lossless).
- [ ] **Step 2: Verify:** typecheck + build; **live end-to-end in the dev server**: drop a PNG, Convert→WebP, Go, confirm progress → result. Compress a JPEG, confirm a smaller file downloads.
- [ ] **Step 3: Commit** `git commit -m "feat(web): convert + compress panels + go bar"`.

---

### Task 12: Resize + Rotate/Flip panels

**Files:** Create `web/src/components/workspace/panels/resize-panel.tsx`, `rotate-panel.tsx`.
**Interfaces:** `ResizePanel` — mode `segmented` (Dimensions / Percent / Preset); Dimensions: width+height inputs with an aspect-lock toggle; Percent: a slider/number; Preset: 1920/1280/640 buttons. Writes `options.resize`. `RotatePanel` — rotation `segmented` (0/90/180/270) + flip toggle (H/V); writes `options.rotate`; a live preview showing the rotation/flip applied (CSS transform on the previewed image).

- [ ] **Step 1: Build** both panels; wire through the GoBar.
- [ ] **Step 2: Verify:** typecheck + build; live: resize a batch by 50% → ZIP downloads; rotate 90° → dimensions swap in the result.
- [ ] **Step 3: Commit** `git commit -m "feat(web): resize + rotate panels"`.

---

### Task 13: Crop panel + interactive overlay

**Files:** Create `web/src/components/workspace/panels/crop-panel.tsx`, `crop-overlay.tsx`.
**Load `ui-ux-pro-max`.** Uses `lib/crop.ts`.
**Interfaces:** `CropPanel` — mode `segmented` (Aspect presets / Freeform). Aspect: 1:1/4:3/16:9/9:16 buttons → batch center-crop (`mode=aspect`). Freeform: single-image only — a draggable/resizable box overlaid on the previewed image (`CropOverlay`, pointer events, using @dnd-kit or hand-rolled pointer math), producing pixel `{x,y,width,height}` in the image's natural resolution (scale from displayed size). Writes `options.crop`. GoBar submits accordingly; for freeform, enforce exactly one selected image (matches the api's 400).

- [ ] **Step 1: Build** the panel + overlay. Aspect presets show a preview of the centered crop (via `centeredBox`). Freeform box math must convert display-pixels → natural-pixels correctly (test the conversion in `crop.ts`).
- [ ] **Step 2: Verify:** typecheck + build; unit test the display→natural rect conversion; live: aspect-crop a batch to 1:1; freeform-crop one image and confirm the downloaded crop matches the box.
- [ ] **Step 3: Commit** `git commit -m "feat(web): crop panel + interactive overlay"`.

---

### Task 14: Result, progress polish, and states

**Files:** Create `web/src/components/workspace/result-card.tsx`, `progress-row.tsx`; refine panels.
**Load `ui-ux-pro-max`.** Uses `motion`.
**Interfaces:** `ProgressRow` — reflects `JobProgress` phases (uploading %, queued + position, processing, downloading) with the Bold Blocks indeterminate animation. `ResultCard` — after a job: before/after (original object-URL vs result thumbnail when renderable; size delta for compress via headers if present), a download button (`downloadBlob`), and a "start over / new job" action. Errors surface the API detail inline. Add motion transitions to tool switches / card add-remove / result reveal.

- [ ] **Step 1: Build** the result + progress components and wire error states across panels (use the API's error detail from `toApiError`).
- [ ] **Step 2: Verify:** typecheck + build; live: run each of the 5 tools once end-to-end, confirm progress → result → download; force an error (e.g. wrong-target) and confirm the message shows.
- [ ] **Step 3: Commit** `git commit -m "feat(web): result card, progress, error + motion polish"`.

---

### Task 15: Web Dockerfile + production build

**Files:** Create `web/Dockerfile`, `web/.dockerignore`.
**Interfaces:** Produces a container serving the built app on `$PORT`. Reference `/Users/oddspace/documents/projects/chowbea/chowbea-pdf/web/Dockerfile` and `.dockerignore`.

- [ ] **Step 1:** Adapt pdf/web `Dockerfile` (bun base, `bun install --frozen-lockfile`, `bun run build`, `bun .output/server/index.mjs` on `$PORT`). Set `VITE_API_URL` as a build ARG/ENV = the live api `https://chowbea-image-production.up.railway.app` (Vite inlines env at build time — it MUST be present at build). `.dockerignore` mirrors pdf/web + excludes `node_modules`, `.output`, `.tanstack`.
- [ ] **Step 2:** Build locally: `docker build -t chowbea-img-web ./web --build-arg VITE_API_URL=https://chowbea-image-production.up.railway.app`; run it, curl `http://localhost:<port>/` → the app HTML loads.
- [ ] **Step 3:** `bun run build` (host) also passes.
- [ ] **Step 4: Commit** `git commit -m "build(web): add Dockerfile for Railway deploy"`.

---

### Task 16: Deploy the web service on Railway + wire CORS

**Files:** none (infra). Uses the Railway CLI + GraphQL (see the api deploy in the git log / ledger for the pattern).
**Interfaces:** Produces a live `web` service in the `chowbea-image` Railway project, and the api's `CHOWBEA_CORS_ORIGINS` set to the web origin.

- [ ] **Step 1:** Create the `web` service in project `chowbea-image` (id `91630ee0-eae0-4b85-98b8-f19d1d74ecd7`, env `production` `77f62cc7-1234-4288-9d03-82d48fe2e296`): `railway add --service web` (or `service source connect --repo ToniChowBea/chowbea-image --branch main --service web`). Set its **root directory = `/web`** via the GraphQL `serviceInstanceUpdate` (the api used this exact pattern — CLI has no root-dir command; token in `~/.railway/config.json` `.user.accessToken`).
- [ ] **Step 2:** Set web service vars: `PORT=8000` (or let Railway inject; match the Dockerfile), and ensure the Docker build gets `VITE_API_URL=https://chowbea-image-production.up.railway.app` (as a build ARG via a service variable Railway passes to the build, or bake it in the Dockerfile). Push (auto-deploy) or `railway up` from `web/`.
- [ ] **Step 3:** Generate a domain: `railway domain --port <web-port> --service web`. Capture the web URL.
- [ ] **Step 4: Wire CORS** on the api: set `CHOWBEA_CORS_ORIGINS=<web-url>` (e.g. `https://web-production-xxxx.up.railway.app`) on the `chowbea-image` api service (id `adc60650-...`) via `railway variables --set` — this triggers an api redeploy.
- [ ] **Step 5: Verify live:** open the web URL, drop a real image, run a Convert→JPEG end-to-end through the browser (proves CORS + the full path). Confirm `GET /queue` reflects the job and the download works.
- [ ] **Step 6:** Update `docs/superpowers/specs/2026-08-01-chowbea-img-design.md` deployment section with the live web URL. Commit any doc change.

---

## Self-Review

**1. Spec coverage** (frontend section of the design spec):
- Gallery-first workspace (grid + toolbar + panel + preview) → Tasks 9–14. ✓
- 5 tool panels incl. crop presets-batch + freeform-single → Tasks 11–13. ✓
- Preview strategy (object-URL + HEIC/TIFF placeholder) → Tasks 6, 9. ✓
- State (one workspace store) → Task 7. ✓
- API client + jobs pipeline reuse → Tasks 2, 4, 5. ✓
- Design system reuse + **evolution** → Task 3 (+ ui-ux-pro-max across UI tasks). ✓
- Queue board + jobs counter + shell → Task 8. ✓
- Deploy web + CORS (the chosen scope) → Tasks 15–16. ✓

**2. Placeholder scan:** Logic tasks (2,4,5,6,7) carry concrete tests + interfaces. UI tasks (3,9–14) carry concrete component contracts, evolved-design direction, named reuse sources, and per-task live verification — the deliberate calibration for a design-forward frontend, not vague "make it nice."

**3. Type/interface consistency:** Tool names (`convert|compress|resize|rotate|crop`), option shapes, and form-field names are defined once in Global Constraints and reused by `lib/api.ts` (T5), the store (T7), and the panels (T11–13). The jobs pipeline types (T4) match the OpenAPI schemas.

**4. Scope:** One plan = the whole frontend + its deploy (the user chose build+deploy). Cohesive; phased 1→16.

---

## Execution Handoff

Filled in at the end of the turn.
