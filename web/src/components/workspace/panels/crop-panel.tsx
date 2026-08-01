import { useRef } from "react"

import { Segmented, SegmentedItem } from "@/components/ui/segmented"
import type { AspectRatio, CropMode } from "@/lib/api"
import { ASPECTS, centeredBox } from "@/lib/crop"
import { useWorkspace, type WorkspaceImage } from "@/stores/workspace"

import { CropOverlay, useImageDisplaySize } from "./crop-overlay"

const MODES: { value: CropMode; label: string }[] = [
  { value: "aspect", label: "Aspect" },
  { value: "rect", label: "Freeform" },
]

const ASPECT_RATIOS: AspectRatio[] = ["1:1", "4:3", "16:9", "9:16"]

/** Non-interactive preview of the centered aspect crop every selected image will get — mirrors the API's `_centered_box`. */
function AspectPreview({ image, ratio }: { image: WorkspaceImage; ratio: AspectRatio }) {
  const imgRef = useRef<HTMLImageElement>(null)
  const { display, onLoad } = useImageDisplaySize(imgRef)
  const [ratioW, ratioH] = ASPECTS[ratio]
  const box = display ? centeredBox(display.width, display.height, ratioW, ratioH) : null

  return (
    <div className="checkerboard relative inline-block max-w-full overflow-hidden rounded-[14px] border-2 border-line">
      <img
        ref={imgRef}
        src={image.url!}
        alt={`Preview of ${image.name} with the ${ratio} crop`}
        onLoad={onLoad}
        className="block max-h-[280px] w-auto max-w-full"
      />
      {box && (
        <div
          className="pointer-events-none absolute border-2 border-dashed border-amber [box-shadow:0_0_0_9999px_color-mix(in_oklch,var(--ink)_45%,transparent)]"
          style={{ left: box.x, top: box.y, width: box.width, height: box.height }}
        />
      )}
    </div>
  )
}

/**
 * Crop tool options: Aspect (batch center-crop every selected image to a
 * ratio, previewed via `centeredBox`) or Freeform (a draggable/resizable
 * box on a single image, via `CropOverlay`).
 */
export function CropPanel() {
  const { mode, aspect, rect } = useWorkspace((state) => state.options.crop)
  const setOption = useWorkspace((state) => state.setOption)
  const images = useWorkspace((state) => state.images)
  const selectedIds = useWorkspace((state) => state.selectedIds)

  const selectedImages = images.filter((img) => selectedIds.has(img.id))
  const previewImage =
    selectedImages.find((img) => img.previewable && img.url) ??
    images.find((img) => img.previewable && img.url)

  return (
    <div className="flex flex-col gap-4 rounded-[14px] border-2 border-dashed border-line p-4">
      <div className="flex flex-col gap-2">
        <p className="text-[11px] font-extrabold tracking-wide text-muted-ink uppercase">Crop by</p>
        <Segmented
          value={mode}
          onValueChange={(value) => setOption("crop", { mode: value as CropMode })}
          aria-label="Crop mode"
        >
          {MODES.map((m) => (
            <SegmentedItem key={m.value} value={m.value}>
              {m.label}
            </SegmentedItem>
          ))}
        </Segmented>
      </div>

      {mode === "aspect" ? (
        <div className="flex flex-col gap-3">
          <Segmented
            value={aspect}
            onValueChange={(value) => setOption("crop", { aspect: value as AspectRatio })}
            className="flex-wrap"
            aria-label="Aspect ratio"
          >
            {ASPECT_RATIOS.map((r) => (
              <SegmentedItem key={r} value={r}>
                {r}
              </SegmentedItem>
            ))}
          </Segmented>
          <p className="text-[13px] font-semibold text-muted-ink">
            Crops every selected image to a centered {aspect} rectangle.
          </p>
          {previewImage && <AspectPreview image={previewImage} ratio={aspect} />}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {selectedImages.length !== 1 ? (
            <p className="text-[13px] font-bold text-destructive">
              {selectedImages.length === 0
                ? "Select an image to draw a freeform crop box."
                : "Freeform crop needs exactly one selected image — deselect the rest."}
            </p>
          ) : !selectedImages[0].previewable || !selectedImages[0].url ? (
            <p className="text-[13px] font-bold text-destructive">
              {selectedImages[0].name} can't be previewed in the browser, so freeform crop isn't
              available for it — try Aspect mode instead.
            </p>
          ) : (
            <CropOverlay
              key={selectedImages[0].id}
              src={selectedImages[0].url}
              alt={`Draw a crop box on ${selectedImages[0].name}`}
              initialRect={rect}
              onRectChange={(next) => setOption("crop", { rect: next })}
            />
          )}
        </div>
      )}
    </div>
  )
}
