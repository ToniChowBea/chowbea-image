import { useEffect, useMemo, useState } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { Download04Icon, FileZipIcon, Refresh01Icon } from "@hugeicons/core-free-icons"

import { Button } from "@/components/ui/button"
import { downloadBlob, formatBytes } from "@/lib/api"
import { isBrowserRenderable, objectUrlFor, revokeUrl } from "@/lib/images"
import { useWorkspace } from "@/stores/workspace"

/**
 * Shown in the tool panel once a job finishes, taking over the preview slot:
 * a before/after (or an "N images · ZIP" summary for batch results), the
 * size delta against the originals, a prominent Download, and ways to start
 * a new job or clear the workspace entirely. Defaults to the workspace store;
 * pass `result` to drive it from a dedicated page (e.g. /fix).
 */
export type ResultPayload = {
  blob: Blob
  filename: string
  originalBytes: number
  fileCount: number
}

export function ResultCard({
  result: resultProp,
  beforeUrl,
  onReset,
  onClear,
  fileNoun = "image",
}: {
  result?: ResultPayload | null
  beforeUrl?: string | null
  onReset?: () => void
  onClear?: () => void
  fileNoun?: string
} = {}) {
  const storeResult = useWorkspace((state) => state.result)
  const result = resultProp !== undefined ? resultProp : storeResult
  const images = useWorkspace((state) => state.images)
  const selectedIds = useWorkspace((state) => state.selectedIds)
  const reset = useWorkspace((state) => state.reset)
  const clear = useWorkspace((state) => state.clear)
  const handleReset = onReset ?? reset
  const handleClear = onClear ?? clear

  const selectedImages = useMemo(
    () => images.filter((image) => selectedIds.has(image.id)),
    [images, selectedIds]
  )
  const before = selectedImages[0] ?? null
  // Frozen at submit time (see go-bar.tsx) so this can't drift if the
  // selection changes while — or after — the job runs.
  const originalBytes = result?.originalBytes ?? 0

  const isZip = result ? result.filename.toLowerCase().endsWith(".zip") : false
  const renderableAfter = Boolean(result) && !isZip && isBrowserRenderable(result!.filename)

  const [afterUrl, setAfterUrl] = useState<string | null>(null)
  useEffect(() => {
    if (!renderableAfter || !result) {
      setAfterUrl(null)
      return
    }
    const url = objectUrlFor(result.blob)
    setAfterUrl(url)
    return () => revokeUrl(url)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result, renderableAfter])

  if (!result) return null

  const delta = originalBytes > 0 ? result.blob.size - originalBytes : null
  const percent = delta !== null ? Math.round((delta / originalBytes) * 100) : null

  return (
    <div className="flex h-full min-h-[280px] flex-col gap-4">
      <div className="flex items-center gap-2">
        <span className="flex size-9 items-center justify-center rounded-xl border-2 border-ink bg-amber text-ink shadow-block-sm">
          <HugeiconsIcon icon={isZip ? FileZipIcon : Download04Icon} className="size-4.5" strokeWidth={2.2} />
        </span>
        <p className="font-heading text-sm font-extrabold tracking-wide text-ink uppercase">Done</p>
      </div>

      {isZip ? (
        <div className="checkerboard flex min-h-[160px] flex-1 flex-col items-center justify-center gap-2 rounded-[14px] border-2 border-line p-4 text-center">
          <span className="flex size-12 items-center justify-center rounded-2xl border-2 border-ink bg-card shadow-block-sm">
            <HugeiconsIcon icon={FileZipIcon} className="size-6 text-ink" strokeWidth={1.8} />
          </span>
          <p className="font-heading text-sm font-extrabold text-ink">
            {result.fileCount > 0
              ? `${result.fileCount} ${fileNoun}${result.fileCount === 1 ? "" : "s"} · ZIP`
              : `Multiple ${fileNoun}s · ZIP`}
          </p>
          <p className="max-w-full truncate text-[12px] font-semibold text-muted-ink" title={result.filename}>
            {result.filename}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <p className="text-[11px] font-extrabold tracking-wide text-muted-ink uppercase">Before</p>
            <div className="checkerboard flex aspect-square items-center justify-center overflow-hidden rounded-[14px] border-2 border-line">
              {(beforeUrl ?? (before?.previewable ? before.url : null)) ? (
                <img
                  src={beforeUrl ?? before!.url!}
                  alt={`Original ${before?.name ?? "file"}`}
                  className="size-full object-contain"
                />
              ) : (
                <span className="px-2 text-center text-[11px] font-bold text-muted-ink">No preview</span>
              )}
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <p className="text-[11px] font-extrabold tracking-wide text-muted-ink uppercase">After</p>
            <div className="checkerboard flex aspect-square items-center justify-center overflow-hidden rounded-[14px] border-2 border-amber">
              {afterUrl ? (
                <img
                  src={afterUrl}
                  alt={`Result: ${result.filename}`}
                  className="size-full object-contain"
                />
              ) : (
                <span className="rounded-md border-2 border-ink bg-card px-2.5 py-1 font-heading text-xs font-extrabold uppercase tracking-wide text-ink shadow-block-sm">
                  {result.filename.split(".").pop()}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {delta !== null && (
        <div className="flex items-center justify-between gap-2 rounded-[12px] border-2 border-line bg-surface px-3 py-2 text-[13px] font-bold text-ink">
          <span>
            {formatBytes(originalBytes)} <span className="text-muted-ink">→</span> {formatBytes(result.blob.size)}
          </span>
          <span className={percent! < 0 ? "text-avif" : percent! > 0 ? "text-destructive" : "text-muted-ink"}>
            {percent! > 0 ? "+" : ""}
            {percent}%
          </span>
        </div>
      )}

      <Button
        type="button"
        onClick={() => downloadBlob(result.blob, result.filename)}
        size="lg"
        className="bg-amber text-ink shadow-block hover:bg-amber active:translate-x-[5px] active:translate-y-[5px] active:shadow-none"
      >
        <HugeiconsIcon icon={Download04Icon} className="size-5" strokeWidth={2.4} />
        Download
      </Button>

      <div className="flex gap-2">
        <Button type="button" variant="secondary" onClick={handleReset} className="flex-1">
          <HugeiconsIcon icon={Refresh01Icon} className="size-4" strokeWidth={2.2} />
          Start over
        </Button>
        <Button type="button" variant="ghost" onClick={handleClear}>
          Clear all
        </Button>
      </div>
    </div>
  )
}
