import { Link } from "@tanstack/react-router"

import { JsonLd } from "@/components/fix/json-ld"
import { GUIDES_SEO, guideCategories, guidesInCategory } from "@/lib/guides"
import { guidesItemListJsonLd } from "@/lib/json-ld"
import { faqJsonLd } from "@/lib/preset-seo"

const GUIDES_FAQ = [
  {
    q: "Which portals have a how-to guide?",
    a: "UK immigration, tax, jobs, education, housing and health portals that have a source URL and a published or clearly labelled limit in our catalogue. VFS Global and Rightmove are skipped — their public pages do not state a verified file-size limit.",
  },
  {
    q: "Are the file-size limits official?",
    a: "Verified guides quote a figure from an official guidance page, with a source link. Where no official byte limit is published, the page says the size is commonly reported. Always check the portal before you submit.",
  },
  {
    q: "Is a single file free?",
    a: "Yes. Fixing one file is free. Files are deleted 1 hour after processing.",
  },
]

/** Category-grouped list of how-to guides, matching the /portals layout. */
export function GuidesIndex() {
  return (
    <div className="page-stack pb-8">
      <JsonLd payload={faqJsonLd(GUIDES_FAQ)} />
      <JsonLd payload={guidesItemListJsonLd()} />

      <div className="flex flex-col gap-5">
        <div className="min-w-0">
          <h1 className="font-heading text-3xl leading-none font-extrabold tracking-tight text-ink uppercase sm:text-[44px]">
            {GUIDES_SEO.h1}
          </h1>
          <p className="mt-1.5 max-w-xl text-[15px] font-semibold text-subtext">
            Pick your portal below, then fix the file — one file is free. Each
            guide quotes the official or commonly reported limit with a source
            link. Format only — not a guarantee of acceptance.
          </p>
        </div>
        <Link
          to="/portals"
          className="press inline-flex w-fit items-center gap-2 rounded-full border-2 border-ink bg-card px-4 py-2 text-[13px] font-extrabold tracking-wide text-ink uppercase shadow-block-sm"
        >
          All UK portals
        </Link>
      </div>

      {guideCategories().map((category) => (
        <GuideGroup
          key={category.id}
          title={category.title}
          guides={guidesInCategory(category.id)}
        />
      ))}
    </div>
  )
}

/** One category heading plus the guide cards in that group. */
function GuideGroup({
  title,
  guides,
}: {
  title: string
  guides: ReturnType<typeof guidesInCategory>
}) {
  return (
    <section>
      <h2 className="mb-4 font-heading text-sm font-extrabold tracking-wide text-ink uppercase">
        {title}
      </h2>
      <div className="grid gap-4 sm:grid-cols-2">
        {guides.map((guide) => (
          <Link
            key={guide.slug}
            to="/guides/$slug"
            params={{ slug: guide.slug }}
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
        ))}
      </div>
    </section>
  )
}
