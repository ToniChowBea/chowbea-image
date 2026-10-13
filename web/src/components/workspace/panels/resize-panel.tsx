import { Segmented, SegmentedItem } from "@/components/ui/segmented"
import { Slider, SliderLabel, SliderValue } from "@/components/ui/slider"
import { ToggleSwitch } from "@/components/ui/toggle-switch"
import type { ResizeMode, ResizePreset } from "@/lib/api"
import { useWorkspace } from "@/stores/workspace"

const MODES: { value: ResizeMode; label: string }[] = [
  { value: "dimensions", label: "Dimensions" },
  { value: "percent", label: "Percent" },
  { value: "preset", label: "Preset" },
]

const PRESETS: { value: ResizePreset; label: string }[] = [
  { value: "1920", label: "1920px" },
  { value: "1280", label: "1280px" },
  { value: "640", label: "640px" },
]

const inputClass =
  "h-10 w-full rounded-xl border-2 border-ink bg-surface px-3 text-sm font-semibold text-ink shadow-block-sm outline-none focus-visible:ring-3 focus-visible:ring-amber/50"

/** Resize tool options: mode switch (dimensions / percent / preset), each with its own fields. */
export function ResizePanel() {
  const { mode, width, height, lockAspect, percent, preset } = useWorkspace(
    (state) => state.options.resize
  )
  const setOption = useWorkspace((state) => state.setOption)

  return (
    <div className="options-well">
      <div className="flex flex-col gap-2">
        <p className="text-[11px] font-extrabold tracking-wide text-muted-ink uppercase">
          Resize by
        </p>
        <Segmented
          value={mode}
          onValueChange={(value) =>
            setOption("resize", { mode: value as ResizeMode })
          }
          className="flex w-full flex-wrap rounded-2xl"
          aria-label="Resize mode"
        >
          {MODES.map((m) => (
            <SegmentedItem key={m.value} value={m.value}>
              {m.label}
            </SegmentedItem>
          ))}
        </Segmented>
      </div>

      {mode === "dimensions" && (
        <div className="flex flex-col gap-3">
          <div className="flex gap-3">
            <label className="flex flex-1 flex-col gap-1.5">
              <span className="font-heading text-sm font-bold text-ink">
                Width
              </span>
              <input
                type="number"
                min={1}
                inputMode="numeric"
                value={width ?? ""}
                onChange={(e) =>
                  setOption("resize", {
                    width:
                      e.target.value === "" ? null : Number(e.target.value),
                  })
                }
                className={inputClass}
              />
            </label>
            <label className="flex flex-1 flex-col gap-1.5">
              <span className="font-heading text-sm font-bold text-ink">
                Height
              </span>
              <input
                type="number"
                min={1}
                inputMode="numeric"
                value={height ?? ""}
                onChange={(e) =>
                  setOption("resize", {
                    height:
                      e.target.value === "" ? null : Number(e.target.value),
                  })
                }
                className={inputClass}
              />
            </label>
          </div>
          <div className="flex items-center justify-between">
            <span className="font-heading text-sm font-bold text-ink">
              Lock aspect ratio
            </span>
            <ToggleSwitch
              checked={lockAspect}
              onChange={(next) => setOption("resize", { lockAspect: next })}
              label="Lock aspect ratio"
            />
          </div>
        </div>
      )}

      {mode === "percent" && (
        <Slider
          value={percent}
          min={10}
          max={200}
          onValueChange={(value) =>
            setOption("resize", {
              percent: Array.isArray(value) ? value[0] : value,
            })
          }
        >
          <div className="flex items-center justify-between">
            <SliderLabel>Scale</SliderLabel>
            <SliderValue />
          </div>
        </Slider>
      )}

      {mode === "preset" && (
        <div className="flex flex-col gap-2">
          <p className="text-[11px] font-extrabold tracking-wide text-muted-ink uppercase">
            Max dimension
          </p>
          <Segmented
            value={preset}
            onValueChange={(value) =>
              setOption("resize", { preset: value as ResizePreset })
            }
            className="flex w-full rounded-2xl"
            aria-label="Resize preset"
          >
            {PRESETS.map((p) => (
              <SegmentedItem key={p.value} value={p.value}>
                {p.label}
              </SegmentedItem>
            ))}
          </Segmented>
        </div>
      )}
    </div>
  )
}
