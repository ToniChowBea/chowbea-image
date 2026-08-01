import { useState } from "react"

import { Button } from "@/components/ui/button"
import { compressImages, convertImages } from "@/lib/api"
import { useWorkspace } from "@/stores/workspace"

/**
 * The shared submit control for every tool: shows how many images are
 * selected and, on click, runs the active tool's API wrapper against the
 * selected files with the current options. Only convert + compress are
 * wired up so far — resize/rotate/crop fall into the `default` branch below
 * until W12-13 add their cases.
 */
export function GoBar() {
  const images = useWorkspace((state) => state.images)
  const selectedIds = useWorkspace((state) => state.selectedIds)
  const activeTool = useWorkspace((state) => state.activeTool)
  const options = useWorkspace((state) => state.options)
  const reset = useWorkspace((state) => state.reset)
  const setProgress = useWorkspace((state) => state.setProgress)
  const setResult = useWorkspace((state) => state.setResult)
  const setError = useWorkspace((state) => state.setError)
  const [running, setRunning] = useState(false)

  const selectedFiles = images.filter((image) => selectedIds.has(image.id)).map((image) => image.file)
  const count = selectedFiles.length

  async function handleGo() {
    if (!activeTool || count === 0) return
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
        default:
          setError(`${activeTool} isn't wired up yet.`)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.")
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-[14px] border-2 border-ink bg-surface p-3">
      <p className="text-[13px] font-bold text-ink">
        {count} image{count === 1 ? "" : "s"} selected
      </p>
      <Button
        type="button"
        onClick={handleGo}
        disabled={count === 0 || running}
        className="bg-amber text-ink shadow-block-sm hover:bg-amber active:translate-x-[3px] active:translate-y-[3px] active:shadow-none"
      >
        {running ? "Working…" : "Go"}
      </Button>
    </div>
  )
}
