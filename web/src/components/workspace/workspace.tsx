import { HugeiconsIcon } from "@hugeicons/react"
import { CursorPointer01Icon } from "@hugeicons/core-free-icons"
import { AnimatePresence, motion } from "motion/react"

import { formatBytes } from "@/lib/api"
import { useWorkspace, type ToolName } from "@/stores/workspace"

import { GoBar } from "./go-bar"
import { ImageGrid } from "./image-grid"
import { CompressPanel } from "./panels/compress-panel"
import { ConvertPanel } from "./panels/convert-panel"
import { CropPanel } from "./panels/crop-panel"
import { ResizePanel } from "./panels/resize-panel"
import { RotatePanel } from "./panels/rotate-panel"
import { ProgressRow } from "./progress-row"
import { ResultCard } from "./result-card"
import { SourcePreview } from "./source-preview"
import { Toolbar, TOOLS } from "./toolbar"

const PANEL_FADE = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -6 },
  transition: { duration: 0.2, ease: [0.22, 1, 0.36, 1] as const },
}

/** Tools that already draw a live preview inside their options well. */
const HAS_INLINE_PREVIEW = new Set<ToolName>(["rotate", "crop"])

/**
 * The panel's right-hand slot for whichever tool is active: a per-tool
 * options block (crossfades on tool switch) above either a source preview,
 * or — once a job finishes — the `ResultCard`, which takes over that slot.
 */
function ToolPanelSlot({ tool }: { tool: ToolName | null }) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      {!tool ? (
        <motion.div key="empty" {...PANEL_FADE}>
          <div className="flex min-h-[240px] flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-line p-6 text-center">
            <span className="flex size-12 items-center justify-center rounded-2xl border-2 border-ink bg-card text-ink shadow-block-sm">
              <HugeiconsIcon
                icon={CursorPointer01Icon}
                className="size-5"
                strokeWidth={2.2}
              />
            </span>
            <p className="font-heading text-sm font-extrabold tracking-wide text-ink uppercase">
              Select a tool
            </p>
            <p className="max-w-[220px] text-[13px] font-semibold text-muted-ink">
              Pick Convert, Compress, Resize, Rotate or Crop above to see its
              options here.
            </p>
          </div>
        </motion.div>
      ) : (
        <motion.div key={tool} {...PANEL_FADE} className="flex flex-col gap-5">
          <ToolPanelBody tool={tool} />
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function ToolPanelBody({ tool }: { tool: ToolName }) {
  const result = useWorkspace((state) => state.result)
  const meta = TOOLS.find((t) => t.id === tool)!

  return (
    <>
      <div className="flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border-2 border-ink bg-amber text-ink shadow-block-sm">
          <HugeiconsIcon
            icon={meta.icon}
            className="size-5"
            strokeWidth={2.2}
          />
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
      ) : (
        <CropPanel />
      )}

      <AnimatePresence mode="wait" initial={false}>
        {result ? (
          <motion.div
            key="result"
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          >
            <ResultCard />
          </motion.div>
        ) : HAS_INLINE_PREVIEW.has(tool) ? null : (
          <motion.div key="preview" {...PANEL_FADE}>
            <SourcePreview />
          </motion.div>
        )}
      </AnimatePresence>

      <GoBar />
    </>
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
    <div className="page-stack">
      <Toolbar />

      <div className="workspace-grid">
        <section className="block-card">
          <p className="mb-4 text-[13px] font-extrabold tracking-wide text-ink uppercase">
            {images.length} image{images.length === 1 ? "" : "s"} ·{" "}
            {formatBytes(totalBytes)}
          </p>
          <ImageGrid />
        </section>

        <aside className="block-card lg:sticky lg:top-7">
          <ToolPanelSlot tool={activeTool} />
        </aside>
      </div>

      <ProgressRow />
    </div>
  )
}
