import { Slider as SliderPrimitive } from "@base-ui/react/slider"

import { cn } from "@/lib/utils"

/**
 * Bold Blocks slider — for quality/percent and resize controls. The track
 * mirrors the progress bar (ink-outlined, amber fill); the thumb is a small
 * ink-outlined block that lifts into its hard shadow on drag, echoing the
 * button/card press language instead of a generic round handle.
 */
function Slider({
  className,
  children,
  value,
  ...props
}: SliderPrimitive.Root.Props) {
  return (
    <SliderPrimitive.Root
      value={value}
      data-slot="slider"
      className={cn("relative flex w-full flex-col gap-1", className)}
      {...props}
    >
      {children}
      <SliderControl>
        <SliderTrack>
          <SliderIndicator />
          <SliderThumb />
        </SliderTrack>
      </SliderControl>
    </SliderPrimitive.Root>
  )
}

function SliderLabel({ className, ...props }: SliderPrimitive.Label.Props) {
  return (
    <SliderPrimitive.Label
      data-slot="slider-label"
      className={cn("font-heading text-sm font-bold text-ink", className)}
      {...props}
    />
  )
}

function SliderValue({ className, ...props }: SliderPrimitive.Value.Props) {
  return (
    <SliderPrimitive.Value
      data-slot="slider-value"
      className={cn("ml-auto text-sm text-subtext tabular-nums", className)}
      {...props}
    />
  )
}

function SliderControl({ className, ...props }: SliderPrimitive.Control.Props) {
  return (
    <SliderPrimitive.Control
      data-slot="slider-control"
      className={cn(
        "relative flex w-full touch-none items-center py-2.5 select-none",
        className
      )}
      {...props}
    />
  )
}

function SliderTrack({ className, ...props }: SliderPrimitive.Track.Props) {
  return (
    <SliderPrimitive.Track
      data-slot="slider-track"
      className={cn(
        "relative h-2.5 w-full rounded-full border-2 border-ink bg-surface",
        className
      )}
      {...props}
    />
  )
}

function SliderIndicator({ className, ...props }: SliderPrimitive.Indicator.Props) {
  return (
    <SliderPrimitive.Indicator
      data-slot="slider-indicator"
      className={cn("h-full rounded-full bg-amber", className)}
      {...props}
    />
  )
}

function SliderThumb({ className, ...props }: SliderPrimitive.Thumb.Props) {
  return (
    <SliderPrimitive.Thumb
      data-slot="slider-thumb"
      className={cn(
        "block size-5 shrink-0 rounded-md border-2 border-ink bg-cream shadow-block-sm outline-none transition-[transform,box-shadow] duration-(--duration-fast) ease-(--ease-snap) select-none hover:-translate-x-px hover:-translate-y-px hover:shadow-block focus-visible:ring-3 focus-visible:ring-amber/50 data-dragging:translate-x-px data-dragging:translate-y-px data-dragging:bg-amber data-dragging:shadow-none",
        className
      )}
      {...props}
    />
  )
}

export {
  Slider,
  SliderLabel,
  SliderValue,
  SliderControl,
  SliderTrack,
  SliderIndicator,
  SliderThumb,
}
