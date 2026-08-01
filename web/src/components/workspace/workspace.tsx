import { HugeiconsIcon } from "@hugeicons/react"
import { CursorPointer01Icon } from "@hugeicons/core-free-icons"

import { Progress, ProgressLabel, ProgressValue } from "@/components/ui/progress"
import { formatBytes } from "@/lib/api"
import type { JobProgress } from "@/lib/jobs"
import { useWorkspace, type ToolName } from "@/stores/workspace"

import { GoBar } from "./go-bar"
import { ImageGrid } from "./image-grid"
import { CompressPanel } from "./panels/compress-panel"
import { ConvertPanel } from "./panels/convert-panel"
import { CropPanel } from "./panels/crop-panel"
import { ResizePanel } from "./panels/resize-panel"
import { RotatePanel } from "./panels/rotate-panel"
import { Toolbar, TOOLS } from "./toolbar"

const PHASE_LABEL: Record<JobProgress["phase"], string> = {
  uploading: "Uploading",
  queued: "Queued in line",
  processing: "Processing",
  downloading: "Downloading",
}

/**
 * The panel's right-hand slot for whichever tool is active. Each tool's real
 * options + live preview land in W11-13; for now this renders a clearly
 * labeled "coming next" placeholder per tool so the two-column layout reads
 * correctly ahead of that work, plus the empty "select a tool" state.
 */
function ToolPanelSlot({ tool }: { tool: ToolName | null }) {
  if (!tool) {
    return (
      <div className="flex h-full min-h-[280px] flex-col items-center justify-center gap-3 rounded-[16px] border-2 border-dashed border-line p-8 text-center">
        <span className="flex size-12 items-center justify-center rounded-2xl border-2 border-ink bg-card text-ink shadow-block-sm">
          <HugeiconsIcon icon={CursorPointer01Icon} className="size-5" strokeWidth={2.2} />
        </span>
        <p className="font-heading text-sm font-extrabold tracking-wide text-ink uppercase">
          Select a tool
        </p>
        <p className="max-w-[220px] text-[13px] font-semibold text-muted-ink">
          Pick Convert, Compress, Resize, Rotate or Crop above to see its options here.
        </p>
      </div>
    )
  }

  const meta = TOOLS.find((t) => t.id === tool)!

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border-2 border-ink bg-amber text-ink shadow-block-sm">
          <HugeiconsIcon icon={meta.icon} className="size-5" strokeWidth={2.2} />
        </span>
        <p className="font-heading text-lg font-extrabold tracking-tight text-ink uppercase">
          {meta.label}
        </p>
      </div>

      {tool === "convert" ? (
        <ConvertPanel />
      ) : tool === "compress" ? (
        <CompressPanel />
      ) : tool === "resize" ? (
        <ResizePanel />
      ) : tool === "rotate" ? (
        <RotatePanel />
      ) : tool === "crop" ? (
        <CropPanel />
      ) : (
        <div className="rounded-[14px] border-2 border-dashed border-line p-4">
          <p className="text-[11px] font-extrabold tracking-wide text-muted-ink uppercase">Options</p>
          <p className="mt-1.5 text-[13px] font-bold text-ink">{meta.label} options — coming next</p>
        </div>
      )}

      <div className="checkerboard flex min-h-[160px] flex-1 items-center justify-center rounded-[14px] border-2 border-dashed border-line p-4">
        <p className="rounded-md border-2 border-ink bg-card px-3 py-1.5 text-[13px] font-bold text-ink shadow-block-sm">
          Preview — coming next
        </p>
      </div>

      <GoBar />
    </div>
  )
}

/** Reserved row for the active job's progress. Idle until a later task wires
a run flow into `setProgress`/`setError` — then this same slot lights up
with a live bar, matching the queue board's "nothing yet" idiom. */
function ProgressRow() {
  const progress = useWorkspace((state) => state.progress)
  const error = useWorkspace((state) => state.error)

  return (
    <div
      role="status"
      aria-live="polite"
      className="rounded-[16px] border-2 border-ink bg-card p-4 shadow-block-sm"
    >
      {error ? (
        <p className="text-sm font-bold text-destructive">{error}</p>
      ) : progress ? (
        <Progress value={progress.percent}>
          <div className="flex w-full items-center justify-between">
            <ProgressLabel>{PHASE_LABEL[progress.phase]}…</ProgressLabel>
            {progress.percent !== null && <ProgressValue />}
          </div>
        </Progress>
      ) : (
        <p className="text-[13px] font-semibold text-muted-ink">
          Nothing running yet — pick a tool, set your options, and go.
        </p>
      )}
    </div>
  )
}

/**
 * The assembled workspace: tool ribbon on top, gallery + active tool's panel
 * in a two-column layout below (stacks to one column on mobile), progress
 * row pinned to the bottom. Rendered by the index route once at least one
 * image has been added.
 */
export function Workspace() {
  const images = useWorkspace((state) => state.images)
  const activeTool = useWorkspace((state) => state.activeTool)
  const totalBytes = images.reduce((sum, image) => sum + image.size, 0)

  return (
    <div className="flex flex-col gap-6">
      <Toolbar />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px] lg:items-start">
        <section className="flex flex-col gap-3">
          <p className="text-[13px] font-bold text-subtext">
            {images.length} image{images.length === 1 ? "" : "s"} · {formatBytes(totalBytes)}
          </p>
          <ImageGrid />
        </section>

        <aside className="rounded-[20px] border-2 border-ink bg-card p-5 shadow-block-sm lg:sticky lg:top-6">
          <ToolPanelSlot tool={activeTool} />
        </aside>
      </div>

      <ProgressRow />
    </div>
  )
}
