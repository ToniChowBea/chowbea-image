import { Slider, SliderLabel, SliderValue } from "@/components/ui/slider"
import { useWorkspace } from "@/stores/workspace"

/** Compress tool options: a single quality slider. */
export function CompressPanel() {
  const { quality } = useWorkspace((state) => state.options.compress)
  const setOption = useWorkspace((state) => state.setOption)

  return (
    <div className="flex flex-col gap-2 rounded-[14px] border-2 border-dashed border-line p-4">
      <Slider
        value={quality}
        min={1}
        max={100}
        onValueChange={(value) =>
          setOption("compress", { quality: Array.isArray(value) ? value[0] : value })
        }
      >
        <div className="flex items-center justify-between">
          <SliderLabel>Quality</SliderLabel>
          <SliderValue />
        </div>
      </Slider>
      <p className="text-[13px] font-semibold text-muted-ink">
        Lower quality means a smaller file size.
      </p>
    </div>
  )
}
