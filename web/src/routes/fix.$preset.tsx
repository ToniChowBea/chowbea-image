import { createFileRoute, Link } from "@tanstack/react-router"
import * as React from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowLeft01Icon, Image01Icon } from "@hugeicons/core-free-icons"

import { PresetFaq } from "@/components/fix/faq"
import { FixReportCard } from "@/components/fix/fix-report"
import { JsonLd } from "@/components/fix/json-ld"
import { PaywallCard } from "@/components/fix/paywall"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ToggleSwitch } from "@/components/ui/toggle-switch"
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
import {
  clearFixToken,
  fetchBillingConfig,
  fetchEntitlement,
  getFixToken,
  type BillingConfig,
} from "@/lib/billing"
import { isBrowserRenderable, objectUrlFor, revokeUrl } from "@/lib/images"
import type { JobProgress } from "@/lib/jobs"
import { appJsonLd, faqJsonLd, fallbackFaq, seoForPreset } from "@/lib/preset-seo"

export const Route = createFileRoute("/fix/$preset")({
  head: ({ params }) => {
    const seo = seoForPreset(params.preset)
    return {
      meta: [
        { title: seo.title },
        { name: "description", content: seo.description },
        { property: "og:title", content: seo.title },
        { property: "og:description", content: seo.description },
      ],
    }
  },
  component: FixPresetPage,
})

/** Image formats we can always decode, plus whatever the portal accepts. */
const DECODE_EXTS = ["png", "jpg", "jpeg", "webp", "avif", "heic", "heif", "gif", "tif", "tiff", "bmp"]
const TYPE_EXTS: Record<string, string[]> = {
  jpeg: ["jpg", "jpeg"],
  png: ["png"],
  tiff: ["tif", "tiff"],
  pdf: ["pdf"],
  doc: ["doc"],
  docx: ["docx"],
  odt: ["odt"],
  gif: ["gif"],
  webp: ["webp"],
}

/** File picker accept list: every image we can decode, plus portal types. */
function acceptFor(preset: Preset): string {
  const extras = preset.accepted_types.flatMap((type) => TYPE_EXTS[type] ?? [type])
  // Presets that accept PDF can take Word input; the worker converts to PDF.
  const office = preset.accepted_types.includes("pdf") ? ["doc", "docx", "odt"] : []
  return [...new Set([...DECODE_EXTS, ...extras, ...office])].map((ext) => `.${ext}`).join(",")
}

/** Short dropzone subtitle listing the portal's accepted types. */
function hintFor(preset: Preset): string {
  const types = preset.accepted_types.map((type) => (type === "jpeg" ? "JPG" : type.toUpperCase()))
  return `One file free · packs paid · ${types.join(" / ")}`
}

/** One-portal fix page: official rules, dropzone, result, FAQ, and JSON-LD. */
function FixPresetPage() {
  const { preset: presetId } = Route.useParams()
  const seo = seoForPreset(presetId)
  const [preset, setPreset] = React.useState<Preset | null | undefined>(undefined)
  const [files, setFiles] = React.useState<File[]>([])
  const [merge, setMerge] = React.useState(false)
  const [progress, setProgress] = React.useState<JobProgress | null>(null)
  const [result, setResult] = React.useState<FixResult | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [submitting, setSubmitting] = React.useState(false)
  const [beforeUrl, setBeforeUrl] = React.useState<string | null>(null)
  const [billing, setBilling] = React.useState<BillingConfig | null>(null)
  const [tokenOk, setTokenOk] = React.useState(false)

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
    let cancelled = false
    fetchBillingConfig()
      .then((config) => {
        if (!cancelled) setBilling(config)
      })
      .catch(() => {
        if (!cancelled) setBilling({ paywall: false, batch_price: "£1.99", pass_price: "£4.99", currency: "gbp" })
      })
    return () => {
      cancelled = true
    }
  }, [])

  React.useEffect(() => {
    const token = getFixToken()
    if (!token || !billing?.paywall) {
      setTokenOk(false)
      return
    }
    let cancelled = false
    fetchEntitlement(token)
      .then((entitlement) => {
        if (cancelled) return
        if (!entitlement.valid) {
          clearFixToken()
          setTokenOk(false)
          return
        }
        setTokenOk(true)
      })
      .catch(() => {
        if (!cancelled) setTokenOk(false)
      })
    return () => {
      cancelled = true
    }
  }, [billing])

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

  const isBatch = files.length > 1
  const paywallOn = Boolean(billing?.paywall)
  const needsPay = isBatch && paywallOn && !tokenOk

  async function handleFix() {
    if (!preset || files.length === 0 || submitting || needsPay) return
    setError(null)
    setResult(null)
    setSubmitting(true)
    try {
      const next = await fixFiles(files, preset.id, setProgress, {
        merge: isBatch ? merge : false,
        token: isBatch ? getFixToken() : null,
      })
      setResult(next)
      if (isBatch && paywallOn) {
        // One-time tokens are consumed server-side; refresh the badge.
        const token = getFixToken()
        if (token) {
          const entitlement = await fetchEntitlement(token)
          if (!entitlement.valid) {
            clearFixToken()
            setTokenOk(false)
          }
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong."
      setError(message)
      if (message.toLowerCase().includes("payment") || message.toLowerCase().includes("token")) {
        clearFixToken()
        setTokenOk(false)
      }
    } finally {
      setSubmitting(false)
      setProgress(null)
    }
  }

  if (preset === undefined) {
    return (
      <div className="pb-10">
        <h1 className="mt-10 font-heading text-3xl font-extrabold uppercase tracking-tight text-ink">
          {seo.h1}
        </h1>
        <p className="mt-4 text-sm font-semibold text-muted-ink">Loading preset…</p>
      </div>
    )
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
  const heading = preset.h1 || seo.h1
  const faq = preset.faq?.length ? preset.faq : fallbackFaq(preset.name)
  const origin = typeof window !== "undefined" ? window.location.origin : ""

  return (
    <div className="pb-10">
      <JsonLd payload={faqJsonLd(faq)} />
      <JsonLd payload={appJsonLd(`${origin}/fix/${preset.id}`, heading, preset.seo_description || seo.description)} />

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
              {heading}
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
              title="Drop files here"
              hint={hintFor(preset)}
              multiple
              onFiles={(picked) => {
                setFiles(picked)
                setResult(null)
                setError(null)
              }}
            />
          ) : (
            <FileList
              files={files}
              onClear={() => {
                setFiles([])
                setResult(null)
              }}
            />
          )}

          {isBatch && (
            <label className="flex items-center justify-between gap-3 rounded-[16px] border-2 border-ink bg-card px-4 py-3 shadow-block-sm">
              <span className="text-[13px] font-extrabold text-ink">
                Merge into one PDF under this limit
              </span>
              <ToggleSwitch checked={merge} onChange={setMerge} label="Merge into one PDF" />
            </label>
          )}

          {needsPay && billing && <PaywallCard config={billing} onError={setError} />}

          {tokenOk && isBatch && (
            <p className="text-[13px] font-semibold text-ink">Payment token ready — this pack is covered.</p>
          )}

          <Button
            type="button"
            size="lg"
            disabled={files.length === 0 || submitting || needsPay}
            onClick={() => void handleFix()}
            className="bg-amber text-ink shadow-block hover:bg-amber"
          >
            {submitting ? "Fixing…" : isBatch ? "Fix evidence pack" : "Fix this file"}
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
          <PresetFaq items={faq} />
        </aside>
      </div>
    </div>
  )
}

function FileList({ files, onClear }: { files: File[]; onClear: () => void }) {
  return (
    <div className="rounded-[16px] border-2 border-ink bg-card px-4 py-3 shadow-block-sm">
      <ul className="flex flex-col gap-2">
        {files.map((file) => (
          <li key={`${file.name}-${file.size}`} className="flex items-center justify-between gap-3">
            <p className="min-w-0 truncate font-heading text-sm font-extrabold text-ink">{file.name}</p>
            <p className="shrink-0 text-[12px] font-semibold text-muted-ink">{formatBytes(file.size)}</p>
          </li>
        ))}
      </ul>
      <Button type="button" variant="ghost" size="sm" className="mt-3" onClick={onClear}>
        Remove
      </Button>
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
