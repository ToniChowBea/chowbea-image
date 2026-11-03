import { createFileRoute, Link } from "@tanstack/react-router"

import { JsonLd } from "@/components/fix/json-ld"
import {
  PORTAL_CATEGORIES,
  PORTAL_IDS_BY_CATEGORY,
} from "@/lib/portal-catalogue"
import {
  PORTALS_SEO,
  appJsonLd,
  faqJsonLd,
  pageSeoHead,
  publicUrl,
  seoForPreset,
} from "@/lib/preset-seo"

const PORTALS_FAQ = [
  {
    q: "Which UK portals can I target?",
    a: "Immigration (UKVI, EU Settlement, UKVCAS, VFS, passport and visa photos), tax and government (HMRC, DVLA, Companies House, DBS, HMCTS), jobs (NHS Jobs, Trac, Civil Service, Indeed, LinkedIn), education (UCAS, SAAS, Student Finance, Ofsted), housing (council evidence, Land Registry, Rightmove, OpenRent), and health (GMC, NMC, PIP).",
  },
  {
    q: "Are the file-size limits official?",
    a: "Verified presets quote a figure from an official guidance page, with a source link. Where no official byte limit is published, we use a conservative commonly reported default and say so on the page. Always check the portal before you submit.",
  },
  {
    q: "Is a single file free?",
    a: "Yes. Fixing one file is free. Files are deleted 1 hour after processing.",
  },
]

export const Route = createFileRoute("/portals")({
  head: () =>
    pageSeoHead(PORTALS_SEO.title, PORTALS_SEO.description, "/portals"),
  component: PortalsIndexPage,
})

/** Server-rendered index of every UK portal preset, grouped by category. */
function PortalsIndexPage() {
  return (
    <div className="page-stack pb-8">
      <JsonLd payload={faqJsonLd(PORTALS_FAQ)} />
      <JsonLd
        payload={appJsonLd(
          publicUrl("/portals"),
          "Chowbea UK portal upload fixer",
          PORTALS_SEO.description
        )}
      />

      <div className="flex flex-col gap-5">
        <div className="min-w-0">
          <h1 className="font-heading text-3xl leading-none font-extrabold tracking-tight text-ink uppercase sm:text-[44px]">
            {PORTALS_SEO.h1}
          </h1>
          <p className="mt-1.5 max-w-xl text-[15px] font-semibold text-subtext">
            Pick a portal, drop a file, and we convert / resize / compress it to
            that portal&apos;s rules. One file is free. Format only — not a
            guarantee of acceptance.
          </p>
        </div>
        <Link
          to="/fix"
          className="press inline-flex w-fit items-center gap-2 rounded-full border-2 border-ink bg-card px-4 py-2 text-[13px] font-extrabold tracking-wide text-ink uppercase shadow-block-sm"
        >
          Generic size targets
        </Link>
      </div>

      {PORTAL_CATEGORIES.map((category) => (
        <PresetGroup
          key={category.id}
          title={category.title}
          ids={PORTAL_IDS_BY_CATEGORY[category.id]}
        />
      ))}
    </div>
  )
}

/** One category heading plus the portal cards in that group. */
function PresetGroup({
  title,
  ids,
}: {
  title: string
  ids: readonly string[]
}) {
  return (
    <section>
      <h2 className="mb-4 font-heading text-sm font-extrabold tracking-wide text-ink uppercase">
        {title}
      </h2>
      <div className="grid gap-4 sm:grid-cols-2">
        {ids.map((id) => {
          const seo = seoForPreset(id)
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
                {seo.description}
              </p>
            </Link>
          )
        })}
      </div>
    </section>
  )
}
