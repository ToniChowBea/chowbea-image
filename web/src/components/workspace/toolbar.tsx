import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react"
import {
  ArrowShrink02Icon,
  CropIcon,
  Exchange02Icon,
  Resize02Icon,
  Rotate01Icon,
} from "@hugeicons/core-free-icons"

import { cn } from "@/lib/utils"
import { useWorkspace, type ToolName } from "@/stores/workspace"

interface ToolDef {
  id: ToolName
  label: string
  icon: IconSvgElement
}

// Exported so the workspace panel can look up the same icon/label per tool
// without a second icon import list drifting from this one.
export const TOOLS: ToolDef[] = [
  { id: "convert", label: "Convert", icon: Exchange02Icon },
  { id: "compress", label: "Compress", icon: ArrowShrink02Icon },
  { id: "resize", label: "Resize", icon: Resize02Icon },
  { id: "rotate", label: "Rotate", icon: Rotate01Icon },
  { id: "crop", label: "Crop", icon: CropIcon },
]

/**
 * The tool ribbon: five chunky icon+label buttons in the Bold Blocks
 * ink-pill toolbar chrome (`.toolbar`). Clicking a tool sets it active in
 * the workspace store; the active button gets the amber "pressed" treatment
 * plus a slow breathing ring so it reads as the live tool at a glance.
 * Labels collapse to icon-only under `sm` (~640px) so five chunky buttons
 * never overflow a phone-width pill — the accessible name stays on the
 * button via `aria-label` even when the visible label is hidden.
 */
export function Toolbar({ className }: { className?: string }) {
  const activeTool = useWorkspace((state) => state.activeTool)
  const setActiveTool = useWorkspace((state) => state.setActiveTool)

  return (
    <div role="group" aria-label="Image tools" className={cn("toolbar w-full", className)}>
      {TOOLS.map((tool) => {
        const active = activeTool === tool.id
        return (
          <button
            key={tool.id}
            type="button"
            aria-pressed={active}
            aria-label={tool.label}
            onClick={() => setActiveTool(tool.id)}
            className={cn(
              "press lift flex flex-1 flex-col items-center justify-center gap-1.5 rounded-[14px] border-2 px-1.5 py-2.5 font-heading text-[11px] font-extrabold tracking-wide text-ink uppercase outline-none transition-colors duration-(--duration-fast) ease-(--ease-snap) focus-visible:ring-3 focus-visible:ring-amber/50 sm:px-2",
              active
                ? "brand-breathe border-ink bg-amber shadow-block-sm"
                : "border-transparent hover:bg-soft-amber"
            )}
          >
            <HugeiconsIcon icon={tool.icon} className="size-6" strokeWidth={2.2} />
            <span className="hidden sm:block">{tool.label}</span>
          </button>
        )
      })}
    </div>
  )
}
