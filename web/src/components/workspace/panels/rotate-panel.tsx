import { Segmented, SegmentedItem } from "@/components/ui/segmented"
import type { FlipDirection } from "@/lib/api"
import { useWorkspace } from "@/stores/workspace"

const ROTATIONS = [0, 90, 180, 270] as const

const FLIPS: { value: FlipDirection; label: string }[] = [
  { value: "none", label: "None" },
  { value: "horizontal", label: "Horizontal" },
  { value: "vertical", label: "Vertical" },
]

/** Rotate tool options: 0/90/180/270 rotation + none/horizontal/vertical flip, with a live CSS preview. */
export function RotatePanel() {
  const { rotation, flip } = useWorkspace((state) => state.options.rotate)
  const setOption = useWorkspace((state) => state.setOption)
  const images = useWorkspace((state) => state.images)
  const selectedIds = useWorkspace((state) => state.selectedIds)
  const previewImage =
    images.find((img) => selectedIds.has(img.id) && img.previewable && img.url) ??
    images.find((img) => img.previewable && img.url)

  const transform = `rotate(${rotation}deg) scaleX(${flip === "horizontal" ? -1 : 1}) scaleY(${
    flip === "vertical" ? -1 : 1
  })`

  return (
    <div className="flex flex-col gap-4 rounded-[14px] border-2 border-dashed border-line p-4">
      <div className="flex flex-col gap-2">
        <p className="text-[11px] font-extrabold tracking-wide text-muted-ink uppercase">Rotate</p>
        <Segmented
          value={String(rotation)}
          onValueChange={(value) => setOption("rotate", { rotation: Number(value) as 0 | 90 | 180 | 270 })}
          aria-label="Rotation"
        >
          {ROTATIONS.map((r) => (
            <SegmentedItem key={r} value={String(r)}>
              {r}°
            </SegmentedItem>
          ))}
        </Segmented>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-[11px] font-extrabold tracking-wide text-muted-ink uppercase">Flip</p>
        <Segmented
          value={flip}
          onValueChange={(value) => setOption("rotate", { flip: value as FlipDirection })}
          aria-label="Flip direction"
        >
          {FLIPS.map((f) => (
            <SegmentedItem key={f.value} value={f.value}>
              {f.label}
            </SegmentedItem>
          ))}
        </Segmented>
      </div>

      {previewImage && (
        <div className="checkerboard flex aspect-square w-full items-center justify-center overflow-hidden rounded-[14px] border-2 border-line">
          <img
            src={previewImage.url!}
            alt={`Preview of ${previewImage.name} with rotation and flip applied`}
            className="max-h-full max-w-full object-contain transition-transform duration-(--duration-fast) ease-(--ease-snap)"
            style={{ transform }}
          />
        </div>
      )}
    </div>
  )
}
