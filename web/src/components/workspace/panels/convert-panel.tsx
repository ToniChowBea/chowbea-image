import { Segmented, SegmentedItem } from "@/components/ui/segmented"
import { Slider, SliderLabel, SliderValue } from "@/components/ui/slider"
import type { ConvertTarget } from "@/lib/api"
import { useWorkspace } from "@/stores/workspace"

const TARGETS: { value: ConvertTarget; label: string }[] = [
  { value: "png", label: "PNG" },
  { value: "jpeg", label: "JPEG" },
  { value: "webp", label: "WebP" },
  { value: "avif", label: "AVIF" },
  { value: "tiff", label: "TIFF" },
]

// PNG and TIFF are lossless — a quality slider has nothing to control there.
const LOSSY_TARGETS = new Set<ConvertTarget>(["jpeg", "webp", "avif"])

/** Convert tool options: target format + a quality slider for lossy targets. */
export function ConvertPanel() {
  const { target, quality } = useWorkspace((state) => state.options.convert)
  const setOption = useWorkspace((state) => state.setOption)

  return (
    <div className="flex flex-col gap-4 rounded-[14px] border-2 border-dashed border-line p-4">
      <div className="flex flex-col gap-2">
        <p className="text-[11px] font-extrabold tracking-wide text-muted-ink uppercase">
          Convert to
        </p>
        <Segmented
          value={target}
          onValueChange={(value) => setOption("convert", { target: value as ConvertTarget })}
          className="flex-wrap"
          aria-label="Target format"
        >
          {TARGETS.map((t) => (
            <SegmentedItem key={t.value} value={t.value}>
              {t.label}
            </SegmentedItem>
          ))}
        </Segmented>
      </div>

      {LOSSY_TARGETS.has(target) && (
        <Slider
          value={quality}
          min={1}
          max={100}
          onValueChange={(value) =>
            setOption("convert", { quality: Array.isArray(value) ? value[0] : value })
          }
        >
          <div className="flex items-center justify-between">
            <SliderLabel>Quality</SliderLabel>
            <SliderValue />
          </div>
        </Slider>
      )}
    </div>
  )
}
