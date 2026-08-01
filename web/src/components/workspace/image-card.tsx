import { HugeiconsIcon } from "@hugeicons/react"
import { Cancel01Icon } from "@hugeicons/core-free-icons"

import { Button } from "@/components/ui/button"
import { kindLabel } from "@/lib/images"
import { formatBytes } from "@/lib/api"
import { useWorkspace, type WorkspaceImage } from "@/stores/workspace"

/**
 * One gallery tile: the `.image-card` frame (ink outline, hard shadow,
 * amber selection ring) wrapping a thumbnail — a real `<img>` when the
 * browser can render the format, otherwise a filetype chip — plus the name,
 * size, and a remove control. The thumbnail+meta area is itself a `<button>`
 * that toggles selection; the remove button sits beside it as a sibling so
 * two interactive controls never nest.
 */
export function ImageCard({ image }: { image: WorkspaceImage }) {
  const selected = useWorkspace((state) => state.selectedIds.has(image.id))
  const toggleSelect = useWorkspace((state) => state.toggleSelect)
  const removeImage = useWorkspace((state) => state.removeImage)
  const kind = kindLabel(image.name)

  return (
    <div className="image-card" data-selected={selected}>
      <button
        type="button"
        aria-pressed={selected}
        aria-label={`${selected ? "Deselect" : "Select"} ${image.name}`}
        onClick={() => toggleSelect(image.id)}
        className="block w-full cursor-pointer border-0 bg-transparent p-0 text-left"
      >
        <div className="checkerboard aspect-square w-full overflow-hidden border-b-2 border-ink">
          {image.previewable && image.url ? (
            <img
              src={image.url}
              alt={image.name}
              loading="lazy"
              decoding="async"
              className="size-full object-cover"
            />
          ) : (
            <div className="flex size-full items-center justify-center bg-soft-amber">
              <span className="rounded-md border-2 border-ink bg-card px-2.5 py-1 font-heading text-xs font-extrabold uppercase tracking-wide text-ink shadow-block-sm">
                {kind}
              </span>
            </div>
          )}
        </div>
        <div className="space-y-0.5 px-2.5 py-2">
          <p className="truncate text-xs font-bold text-ink" title={image.name}>
            {image.name}
          </p>
          <p className="text-[11px] font-semibold text-muted-ink">{formatBytes(image.size)}</p>
        </div>
      </button>

      <Button
        type="button"
        variant="secondary"
        size="icon-sm"
        aria-label={`Remove ${image.name}`}
        onClick={() => removeImage(image.id)}
        className="absolute top-1.5 right-1.5 bg-card"
      >
        <HugeiconsIcon icon={Cancel01Icon} className="size-4" strokeWidth={2.4} />
      </Button>
    </div>
  )
}
