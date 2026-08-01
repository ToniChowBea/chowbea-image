import { useState } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { Alert01Icon, Cancel01Icon } from "@hugeicons/core-free-icons"
import { AnimatePresence, motion } from "motion/react"

import { Button } from "@/components/ui/button"
import { compressImages, convertImages, cropImages, resizeImages, rotateImages } from "@/lib/api"
import { useWorkspace } from "@/stores/workspace"

/**
 * The shared submit control for every tool: shows how many images are
 * selected and, on click, runs the active tool's API wrapper against the
 * selected files with the current options.
 *
 * Freeform crop (`options.crop.mode === "rect"`) is the one tool with an
 * extra precondition — the API only accepts a `rect` crop for a single
 * file, so Go stays disabled until exactly one previewable image is
 * selected and a box has been drawn (`options.crop.rect` set).
 */
export function GoBar() {
  const images = useWorkspace((state) => state.images)
  const selectedIds = useWorkspace((state) => state.selectedIds)
  const activeTool = useWorkspace((state) => state.activeTool)
  const options = useWorkspace((state) => state.options)
  const error = useWorkspace((state) => state.error)
  const reset = useWorkspace((state) => state.reset)
  const setProgress = useWorkspace((state) => state.setProgress)
  const setResult = useWorkspace((state) => state.setResult)
  const setError = useWorkspace((state) => state.setError)
  const [running, setRunning] = useState(false)

  const selectedFiles = images.filter((image) => selectedIds.has(image.id)).map((image) => image.file)
  const count = selectedFiles.length
  const cropRectBlocked =
    activeTool === "crop" && options.crop.mode === "rect" && (count !== 1 || !options.crop.rect)
  const canSubmit = count > 0 && !cropRectBlocked

  async function handleGo() {
    if (!activeTool || !canSubmit) return
    reset()
    setRunning(true)
    try {
      switch (activeTool) {
        case "convert": {
          const { target, quality } = options.convert
          const lossy = target === "jpeg" || target === "webp" || target === "avif"
          setResult(await convertImages(selectedFiles, target, lossy ? quality : null, setProgress))
          break
        }
        case "compress": {
          setResult(await compressImages(selectedFiles, options.compress.quality, setProgress))
          break
        }
        case "resize": {
          // Store keeps width/height as `null` for empty inputs; the API
          // wrapper wants them omitted (`undefined`) instead.
          const { width, height, ...rest } = options.resize
          setResult(
            await resizeImages(
              selectedFiles,
              { ...rest, width: width ?? undefined, height: height ?? undefined },
              setProgress
            )
          )
          break
        }
        case "rotate": {
          setResult(await rotateImages(selectedFiles, options.rotate, setProgress))
          break
        }
        case "crop": {
          const { mode, aspect, rect } = options.crop
          setResult(
            await cropImages(
              selectedFiles,
              mode === "rect" ? { mode, rect: rect! } : { mode, aspect },
              setProgress
            )
          )
          break
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.")
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <AnimatePresence initial={false}>
        {error && (
          <motion.div
            key="go-bar-error"
            role="alert"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="flex items-start gap-2.5 rounded-[14px] border-2 border-destructive bg-destructive/10 p-3">
              <HugeiconsIcon
                icon={Alert01Icon}
                className="mt-0.5 size-4.5 shrink-0 text-destructive"
                strokeWidth={2.2}
              />
              <p className="flex-1 text-[13px] font-bold text-destructive">{error}</p>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Dismiss error"
                onClick={reset}
                className="shrink-0 text-destructive hover:bg-destructive/10"
              >
                <HugeiconsIcon icon={Cancel01Icon} className="size-4" strokeWidth={2.4} />
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-center justify-between gap-3 rounded-[14px] border-2 border-ink bg-surface p-3">
        <p className="text-[13px] font-bold text-ink">
          {count} image{count === 1 ? "" : "s"} selected
        </p>
        <Button
          type="button"
          onClick={handleGo}
          disabled={!canSubmit || running}
          className="bg-amber text-ink shadow-block-sm hover:bg-amber active:translate-x-[3px] active:translate-y-[3px] active:shadow-none"
        >
          {running ? "Working…" : "Go"}
        </Button>
      </div>
    </div>
  )
}
