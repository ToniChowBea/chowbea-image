import { createFileRoute, Link } from "@tanstack/react-router"

import { GuideArticle } from "@/components/guides/guide-article"
import { guideFor } from "@/lib/guides"
import { pageSeoHead } from "@/lib/preset-seo"

export const Route = createFileRoute("/guides/$slug")({
  head: ({ params }) => {
    const guide = guideFor(params.slug)
    if (!guide) {
      return pageSeoHead(
        "Guide not found | Chowbea",
        "That how-to guide does not exist.",
        `/guides/${params.slug}`
      )
    }
    return pageSeoHead(
      guide.title,
      guide.description,
      `/guides/${guide.slug}`,
      `/og/${guide.presetId}.png`
    )
  },
  component: GuidePage,
})

/** One portal how-to: official limit, steps, CTA into the matching fixer. */
function GuidePage() {
  const { slug } = Route.useParams()
  const guide = guideFor(slug)

  if (!guide) {
    return (
      <div className="page-stack items-center text-center">
        <p className="font-heading text-2xl font-extrabold text-ink">
          Unknown guide
        </p>
        <Link
          to="/guides"
          className="press inline-flex items-center gap-2 rounded-full border-2 border-ink bg-card px-4 py-2 text-[13px] font-extrabold tracking-wide text-ink uppercase shadow-block-sm"
        >
          All guides
        </Link>
      </div>
    )
  }

  return <GuideArticle guide={guide} />
}
