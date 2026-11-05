import { Link } from "@tanstack/react-router"

import { guideFor, relatedGuideIds } from "@/lib/guides"

/**
 * Internal links to sibling how-to pages in the same /guides category.
 * Card chrome matches the /guides index and /portals grid.
 */
export function RelatedGuides({ slug }: { slug: string }) {
  const ids = relatedGuideIds(slug)
  if (ids.length === 0) return null

  return (
    <section>
      <h2 className="mb-4 font-heading text-sm font-extrabold tracking-wide text-ink uppercase">
        Related guides
      </h2>
      <div className="grid gap-4 sm:grid-cols-2">
        {ids.map((id) => {
          const guide = guideFor(id)
          if (!guide) return null
          return (
            <Link
              key={id}
              to="/guides/$slug"
              params={{ slug: id }}
              className="press group flex flex-col gap-2 rounded-[20px] border-2 border-ink bg-card p-5 shadow-block-sm hover:bg-surface"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="font-heading text-base font-extrabold text-ink">
                  {guide.h1}
                </p>
                <span className="font-heading text-lg font-extrabold text-ink">
                  →
                </span>
              </div>
              <p className="text-[13px] font-semibold text-muted-ink">
                {guide.limit}
                {guide.verified ? "" : " · commonly reported"}
              </p>
            </Link>
          )
        })}
      </div>
    </section>
  )
}
