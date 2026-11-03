import { Link } from "@tanstack/react-router"

import { relatedPresetIds, categoryForPreset } from "@/lib/portal-catalogue"
import { ogCard } from "@/lib/og-copy"
import { seoForPreset } from "@/lib/preset-seo"

/**
 * Internal links to sibling presets. Card chrome matches the /portals grid
 * (20px radius, 20px padding, ink border, 16px gaps).
 */
export function RelatedPresets({ presetId }: { presetId: string }) {
  const ids = relatedPresetIds(presetId)
  if (ids.length === 0) return null
  const heading =
    categoryForPreset(presetId) === "generic"
      ? "Related size targets"
      : "Related portals"

  return (
    <section>
      <h2 className="mb-4 font-heading text-sm font-extrabold tracking-wide text-ink uppercase">
        {heading}
      </h2>
      <div className="grid gap-4 sm:grid-cols-2">
        {ids.map((id) => {
          const seo = seoForPreset(id)
          const card = ogCard(id)
          return (
            <Link
              key={id}
              to="/fix/$preset"
              params={{ preset: id }}
              className="press group flex flex-col gap-2 rounded-[20px] border-2 border-ink bg-card p-5 shadow-block-sm hover:bg-surface"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="font-heading text-base font-extrabold text-ink">
                  {seo.h1}
                </p>
                <span className="font-heading text-lg font-extrabold text-ink">
                  →
                </span>
              </div>
              <p className="text-[13px] font-semibold text-muted-ink">
                {card.limit} limit
              </p>
            </Link>
          )
        })}
      </div>
    </section>
  )
}
