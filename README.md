# Chowbea Image — upload-limit fixer

No-signup web tool: pick a UK portal preset (UK passport/visa photo, UCAS, SAAS, UKVCAS, VFS, NHS Jobs, or a generic size cap), drop one or more files, and get them converted, resized and compressed to that portal’s rules with a pass/fail report per rule.

Single files are free. Evidence packs (two or more files, optionally merged to one PDF) are a Stripe one-off when keys are set. Files auto-delete after **1 hour**. File contents and names are never logged.

This repo also has the original image toolkit (convert, compress, resize, rotate, crop) on `/`.

## What you need locally

- Python 3.12, [uv](https://docs.astral.sh/uv/), [Bun](https://bun.sh/)
- RabbitMQ
- Ghostscript (`gs`) for PDF compress-to-target
- LibreOffice (`soffice`) for DOC/DOCX/ODT → PDF on presets that accept PDF

```bash
# Debian/Ubuntu
sudo apt-get install ghostscript libreoffice-writer rabbitmq-server libvips42

# macOS
brew install ghostscript rabbitmq vips
brew install --cask libreoffice
```

## Local setup (without Docker)

```bash
cp .env.example .env   # optional; defaults work for a free local fixer

# API + worker (one process consumes the queue)
cd api
uv sync --group dev
uv run pytest
uv run uvicorn app.main:app --reload   # needs RabbitMQ at CHOWBEA_RABBITMQ_URL

# Web
cd web
bun install
bun run test
bun dev   # VITE_API_URL=http://localhost:8000
```

Open `/fix`, pick a preset. One file → Fix. Several files → evidence pack (merge toggle). `/privacy` for the retention policy. `GET /health` on the API is the liveness check.

## Docker Compose

```bash
cp .env.example .env
docker compose up --build
```

Starts RabbitMQ, an HTTP API (`CHOWBEA_RUN_WORKER=false`), a worker replica of the same image (`CHOWBEA_RUN_WORKER=true`), and the web app on http://localhost:3000. The API is http://localhost:8000.

The worker image installs Ghostscript and LibreOffice Writer. Builds are large because of LibreOffice.

## Environment variables

See [`.env.example`](.env.example) for every variable (no real values). Summary:

| Variable | Where | Notes |
| --- | --- | --- |
| `CHOWBEA_RABBITMQ_URL` | API / worker | Broker URL |
| `CHOWBEA_CORS_ORIGINS` | API | Comma-separated web origins |
| `CHOWBEA_DATA_DIR` | API / worker | Durable counter + entitlement JSON; mount a volume |
| `CHOWBEA_FIX_MAX_FILES` | API | Pack file-count cap (default 20) |
| `CHOWBEA_FIX_MAX_UPLOAD_MB` | API | Per-file cap on `/img/fix` (default 50) |
| `CHOWBEA_FIX_FREE_RATE_PER_MINUTE` | API | Per-IP free-fix rate limit (default 10) |
| `CHOWBEA_RUN_WORKER` | API / worker | `true` consumes jobs; `false` is HTTP-only |
| `CHOWBEA_TRUST_FORWARDED_IP` | API | `true` behind Railway / a proxy |
| `CHOWBEA_RESULT_TTL_MINUTES` | API | Auto-delete window (default 60) |
| `STRIPE_SECRET_KEY` `STRIPE_WEBHOOK_SECRET` `STRIPE_PRICE_BATCH` `STRIPE_PRICE_PASS` | API | Paywall **off** if any are empty |
| `FIX_TOKEN_SECRET` | API | Optional; defaults to the webhook secret |
| `PUBLIC_WEB_URL` | API | Checkout redirects |
| `POSTHOG_API_KEY` `POSTHOG_HOST` | API | Optional server events; off when empty |
| `VITE_API_URL` | Web **build** | Browser origin of the API |
| `VITE_PUBLIC_SITE_URL` | Web **build** | Public https origin for sitemap, robots, canonical, OG. Defaults to `https://img.chowbea.com` |
| `VITE_PUBLIC_POSTHOG_KEY` `VITE_PUBLIC_POSTHOG_HOST` | Web **build** | Optional browser events; off when empty |

Do not commit live secrets. Stripe: use **test-mode** keys and two one-time GBP Prices (£1.99 pack, £4.99 24h pass). Webhook: `POST https://<api-host>/billing/webhook`.

## Deploy (Railway, not run from this repo)

Nothing in this milestone deploys or creates cloud resources. A typical Railway layout:

1. **RabbitMQ** — Railway plugin / template, then set `CHOWBEA_RABBITMQ_URL`.
2. **API** — Dockerfile at `api/Dockerfile`. Health check `GET /health`. Volume on `CHOWBEA_DATA_DIR=/data`. Default `CHOWBEA_RUN_WORKER=true` so one service both serves HTTP and consumes jobs. Set `CHOWBEA_TRUST_FORWARDED_IP=true`, `CHOWBEA_CORS_ORIGINS` to the web origin, `PUBLIC_WEB_URL` to the same.
3. **Web** — Dockerfile at `web/Dockerfile`. Build arg / env `VITE_API_URL=https://<api-host>` (Vite inlines this at build time). Optional `VITE_PUBLIC_SITE_URL=https://img.chowbea.com` for sitemap/canonical URLs; that https origin is the code default.
4. Optional **worker replica** of the API image with `CHOWBEA_RUN_WORKER=true` if you set the HTTP service to `CHOWBEA_RUN_WORKER=false`.

Ghostscript and LibreOffice are already in the API image. You still need to supply Stripe (and optionally PostHog) keys yourself.

## Tests

```bash
cd api && uv run pytest
cd web && bun run test
```

CI (GitHub Actions) runs both on every push and pull request, with Ghostscript installed for the API job.

## Privacy

Uploads live in a job workspace and are swept **1 hour** after finish (or 1 hour after create if the job never finishes), including failures. Logs do not include file names or contents. Optional PostHog events record only preset id, file type, counts, and checkout kind — never names or bytes — and are off when the key is missing. Details: `/privacy`.
