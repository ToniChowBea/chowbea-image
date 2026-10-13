import { kindLabel } from "@/lib/images"
import { useWorkspace } from "@/stores/workspace"

/**
 * Live "before" preview of the current selection. Browser-renderable
 * formats show the object URL on the checkerboard; HEIC/TIFF fall back to
 * a type chip. Shown in the tool panel until a job result takes over.
 */
export function SourcePreview() {
  const images = useWorkspace((state) => state.images)
  const selectedIds = useWorkspace((state) => state.selectedIds)
  const selected = images.filter((image) => selectedIds.has(image.id))
  const preview =
    selected.find((image) => image.previewable && image.url) ??
    selected[0] ??
    null

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-extrabold tracking-wide text-muted-ink uppercase">
          Before
        </p>
        {selected.length > 1 && (
          <p className="text-[11px] font-bold text-muted-ink">
            {selected.length} selected
          </p>
        )}
      </div>
      <div className="checkerboard flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-[14px] border-2 border-line">
        {preview?.previewable && preview.url ? (
          <img
            src={preview.url}
            alt={`Selected: ${preview.name}`}
            className="size-full object-contain"
          />
        ) : preview ? (
          <span className="rounded-md border-2 border-ink bg-card px-2.5 py-1 font-heading text-xs font-extrabold tracking-wide text-ink uppercase shadow-block-sm">
            {kindLabel(preview.name)}
          </span>
        ) : (
          <p className="px-3 text-center text-[13px] font-semibold text-muted-ink">
            Select an image to preview
          </p>
        )}
      </div>
    </div>
  )
}
