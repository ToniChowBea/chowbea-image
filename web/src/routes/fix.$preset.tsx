import { createFileRoute, Link } from "@tanstack/react-router"
import * as React from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowLeft01Icon, Image01Icon } from "@hugeicons/core-free-icons"

import { FixReportCard } from "@/components/fix/fix-report"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dropzone } from "@/components/workspace/dropzone"
import { ProgressRow } from "@/components/workspace/progress-row"
import { ResultCard } from "@/components/workspace/result-card"
import {
  fetchPreset,
  fixFiles,
  formatBytes,
  type FixResult,
  type Preset,
} from "@/lib/api"
import { isBrowserRenderable, objectUrlFor, revokeUrl } from "@/lib/images"
import type { JobProgress } from "@/lib/jobs"

export const Route = createFileRoute("/fix/$preset")({ component: FixPresetPage })

/** Image formats we can always decode, plus whatever the portal accepts. */
const DECODE_EXTS = ["png", "jpg", "jpeg", "webp", "avif", "heic", "heif", "gif", "tif", "tiff", "bmp"]
const TYPE_EXTS: Record<string, string[]> = {
  jpeg: ["jpg", "jpeg"],
  png: ["png"],
  tiff: ["tif", "tiff"],
  pdf: ["pdf"],
  doc: ["doc"],
  docx: ["docx"],
  gif: ["gif"],
  webp: ["webp"],
}

/** File picker accept list: every image we can decode, plus portal types. */
function acceptFor(preset: Preset): string {
  const extras = preset.accepted_types.flatMap((type) => TYPE_EXTS[type] ?? [type])
  return [...new Set([...DECODE_EXTS, ...extras])].map((ext) => `.${ext}`).join(",")
}

/** Short dropzone subtitle listing the portal's accepted types. */
function hintFor(preset: Preset): string {
  const types = preset.accepted_types.map((type) => (type === "jpeg" ? "JPG" : type.toUpperCase()))
  return `Images, plus ${types.join(" / ")}`
}

/** One-portal fix page: official rules, dropzone, result, and per-rule report. */
function FixPresetPage() {
  const { preset: presetId } = Route.useParams()
  const [preset, setPreset] = React.useState<Preset | null | undefined>(undefined)
  const [files, setFiles] = React.useState<File[]>([])
  const [progress, setProgress] = React.useState<JobProgress | null>(null)
  const [result, setResult] = React.useState<FixResult | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [submitting, setSubmitting] = React.useState(false)
  const [beforeUrl, setBeforeUrl] = React.useState<string | null>(null)

  React.useEffect(() => {
    let cancelled = false
    fetchPreset(presetId)
      .then((item) => {
        if (!cancelled) setPreset(item)
      })
      .catch(() => {
        if (!cancelled) setPreset(null)
      })
    return () => {
      cancelled = true
    }
  }, [presetId])

  React.useEffect(() => {
    const first = files[0]
    if (!first || !isBrowserRenderable(first.name)) {
      setBeforeUrl(null)
      return
    }
    const url = objectUrlFor(first)
    setBeforeUrl(url)
    return () => revokeUrl(url)
  }, [files])

  async function handleFix() {
    if (!preset || files.length === 0 || submitting) return
    setError(null)
    setResult(null)
    setSubmitting(true)
    try {
      const next = await fixFiles(files, preset.id, setProgress)
      setResult(next)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.")
    } finally {
      setSubmitting(false)
      setProgress(null)
    }
  }

  if (preset === undefined) {
    return <p className="mt-12 text-sm font-semibold text-muted-ink">Loading preset…</p>
  }

  if (preset === null) {
    return (
      <div className="mt-16 text-center">
        <p className="font-heading text-2xl font-extrabold text-ink">Unknown preset</p>
        <Link
          to="/fix"
          className="press mt-4 inline-flex items-center gap-2 rounded-full border-2 border-ink bg-card px-4 py-2 text-[13px] font-extrabold uppercase tracking-wide text-ink shadow-block-sm"
        >
          All presets
        </Link>
      </div>
    )
  }

  const originalBytes = files.reduce((sum, file) => sum + file.size, 0)

  return (
    <div className="pb-10">
      <Link
        to="/fix"
        className="press mt-8 inline-flex items-center gap-2 rounded-full border-2 border-ink bg-card px-4 py-2 text-[13px] font-extrabold uppercase tracking-wide text-ink shadow-block-sm"
      >
        <HugeiconsIcon icon={ArrowLeft01Icon} className="size-3.5" strokeWidth={2.6} />
        All presets
      </Link>

      <div className="mt-5 flex items-start gap-4">
        <span className="flex size-14 shrink-0 items-center justify-center rounded-[15px] border-2 border-ink bg-amber text-ink shadow-block-sm">
          <HugeiconsIcon icon={Image01Icon} className="size-7" strokeWidth={2.2} />
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-heading text-3xl font-extrabold uppercase leading-none tracking-tight text-ink">
              {preset.name}
            </h1>
            <Badge variant={preset.verified ? "amber" : "outline"}>
              {preset.verified ? "Verified" : "Unverified"}
            </Badge>
          </div>
          {preset.last_checked && (
            <p className="mt-2 text-[13px] font-semibold text-muted-ink">
              Rules last checked {preset.last_checked}
            </p>
          )}
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_minmax(280px,340px)]">
        <div className="flex flex-col gap-4">
          {files.length === 0 ? (
            <Dropzone
              accept={acceptFor(preset)}
              title="Drop a file here"
              hint={hintFor(preset)}
              multiple={false}
              onFiles={(picked) => {
                setFiles(picked.slice(0, 1))
                setResult(null)
                setError(null)
              }}
            />
          ) : (
            <div className="flex items-center justify-between gap-3 rounded-[16px] border-2 border-ink bg-card px-4 py-3 shadow-block-sm">
              <div className="min-w-0">
                <p className="truncate font-heading text-sm font-extrabold text-ink">{files[0].name}</p>
                <p className="text-[12px] font-semibold text-muted-ink">{formatBytes(files[0].size)}</p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setFiles([])
                  setResult(null)
                }}
              >
                Remove
              </Button>
            </div>
          )}

          <Button
            type="button"
            size="lg"
            disabled={files.length === 0 || submitting}
            onClick={() => void handleFix()}
            className="bg-amber text-ink shadow-block hover:bg-amber"
          >
            {submitting ? "Fixing…" : "Fix this file"}
          </Button>

          {error && (
            <p className="rounded-[12px] border-2 border-destructive bg-destructive/10 px-4 py-3 text-sm font-semibold text-destructive">
              {error}
            </p>
          )}

          <ProgressRow
            progress={progress}
            idleLabel="Drop a file and hit Fix — we convert, resize and compress to this portal's limits."
          />

          {result && (
            <ResultCard
              result={{
                blob: result.blob,
                filename: result.filename,
                originalBytes,
                fileCount: files.length,
              }}
              beforeUrl={beforeUrl}
              onReset={() => {
                setResult(null)
                setError(null)
              }}
              onClear={() => {
                setFiles([])
                setResult(null)
                setError(null)
              }}
              fileNoun="file"
            />
          )}
        </div>

        <aside className="flex flex-col gap-4">
          <RulesCard preset={preset} />
          <p className="rounded-[16px] border-2 border-ink bg-soft-amber px-4 py-3 text-[13px] font-semibold text-ink">
            This tool only fixes file format, size and pixels. It does not check faces, backgrounds
            or content, and it does not guarantee a portal will accept the file.
          </p>
          {result?.report && <FixReportCard report={result.report} />}
        </aside>
      </div>
    </div>
  )
}

function RulesCard({ preset }: { preset: Preset }) {
  const types = preset.accepted_types.map((type) => (type === "jpeg" ? "JPG" : type.toUpperCase()))
  const size =
    preset.min_bytes && preset.max_bytes
      ? `${formatBytes(preset.min_bytes)} – ${formatBytes(preset.max_bytes)}`
      : preset.max_bytes
        ? `up to ${formatBytes(preset.max_bytes)}`
        : null

  return (
    <div className="rounded-[16px] border-2 border-ink bg-card p-4 shadow-block-sm">
      <p className="mb-3 font-heading text-sm font-extrabold uppercase tracking-wide text-ink">
        Official rules
      </p>
      <ul className="flex flex-col gap-1.5 text-[13px] font-semibold text-ink">
        <li>Type: {types.join(", ")}</li>
        {size && <li>Size: {size}</li>}
        {(preset.min_width || preset.min_height) && (
          <li>
            Minimum pixels: {preset.min_width ?? "—"} × {preset.min_height ?? "—"}
          </li>
        )}
        {preset.orientation !== "any" && <li>Orientation: {preset.orientation}</li>}
        {preset.colour && <li>Colour</li>}
        {preset.do_not_crop && <li>Do not crop — the portal crops</li>}
        {preset.no_password && <li>No password protection</li>}
        {preset.preferred_type && (
          <li>Preferred: {preset.preferred_type === "jpeg" ? "JPG" : preset.preferred_type.toUpperCase()}</li>
        )}
      </ul>
      {preset.notes && <p className="mt-3 text-[13px] font-medium text-subtext">{preset.notes}</p>}
      {preset.source_url && (
        <a
          href={preset.source_url}
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-extrabold text-ink underline decoration-2 underline-offset-2"
        >
          Source ↗
        </a>
      )}
    </div>
  )
}
