import { cn } from "@/lib/utils"

/**
 * A Bold Blocks on/off switch: ink-outlined pill that fills amber when on, with
 * a solid ink knob that slides to the active side.
 */
export function ToggleSwitch({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (next: boolean) => void
  label: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-7 w-[50px] shrink-0 rounded-full border-2 border-ink transition-colors duration-(--duration-fast) ease-(--ease-snap)",
        checked ? "bg-amber" : "bg-card",
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 left-0.5 size-5 rounded-full bg-ink transition-transform duration-(--duration-fast) ease-(--ease-snap)",
          checked ? "translate-x-[22px]" : "translate-x-0",
        )}
      />
    </button>
  )
}
