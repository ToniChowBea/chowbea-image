import { Link } from "@tanstack/react-router"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowRight02Icon } from "@hugeicons/core-free-icons"

/**
 * Amber fixer CTA that deep-links a how-to page into /fix/<preset>.
 * Same chrome as the existing steps-card button so both CTAs match.
 */
export function GuideCta({
  presetId,
  label,
}: {
  presetId: string
  label: string
}) {
  return (
    <Link
      to="/fix/$preset"
      params={{ preset: presetId }}
      className="press inline-flex w-fit items-center gap-2.5 rounded-full border-2 border-ink bg-amber px-6 py-3.5 font-heading text-base font-extrabold tracking-wide text-ink uppercase shadow-block"
    >
      {label}
      <HugeiconsIcon
        icon={ArrowRight02Icon}
        className="size-5"
        strokeWidth={2.4}
      />
    </Link>
  )
}
