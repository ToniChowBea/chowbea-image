import { ToggleGroup as ToggleGroupPrimitive } from "@base-ui/react/toggle-group"
import { Toggle as TogglePrimitive } from "@base-ui/react/toggle"

import { cn } from "@/lib/utils"

/**
 * Bold Blocks segmented control — for single-choice switches like crop
 * aspect, resize mode, or which tool is active. An ink-outlined pill holds
 * the options; the active segment fills solid ink, mirroring the primary
 * button treatment instead of a soft radio-pill.
 */
interface SegmentedProps<Value extends string = string>
  extends Omit<
    ToggleGroupPrimitive.Props<Value>,
    "value" | "defaultValue" | "onValueChange" | "multiple"
  > {
  value?: Value
  defaultValue?: Value
  onValueChange?: (value: Value) => void
}

function Segmented<Value extends string = string>({
  className,
  value,
  defaultValue,
  onValueChange,
  ...props
}: SegmentedProps<Value>) {
  return (
    <ToggleGroupPrimitive
      data-slot="segmented"
      value={value === undefined ? undefined : [value]}
      defaultValue={defaultValue === undefined ? undefined : [defaultValue]}
      onValueChange={(next) => {
        // Base UI's toggle-group deselects on re-click of the active item,
        // firing with an empty array. A segmented control must always have
        // exactly one selection, so ignore that case — the controlled
        // `value` prop keeps the current item visually selected.
        if (next.length > 0) onValueChange?.(next[0] as Value)
      }}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border-2 border-ink bg-surface p-1 shadow-block-sm",
        className
      )}
      {...props}
    />
  )
}

function SegmentedItem({
  className,
  ...props
}: TogglePrimitive.Props<string>) {
  return (
    <TogglePrimitive
      data-slot="segmented-item"
      className={cn(
        "inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-full px-4 font-heading text-xs font-extrabold tracking-wide text-ink uppercase outline-none transition-colors duration-(--duration-fast) ease-(--ease-snap) select-none hover:bg-soft-amber focus-visible:ring-3 focus-visible:ring-amber/50 disabled:pointer-events-none disabled:opacity-45 data-pressed:bg-ink data-pressed:text-cream data-pressed:hover:bg-ink [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    />
  )
}

export { Segmented, SegmentedItem }
