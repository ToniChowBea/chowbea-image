import { createFileRoute, Link } from "@tanstack/react-router"
import * as React from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { Image01Icon } from "@hugeicons/core-free-icons"

import { JsonLd } from "@/components/fix/json-ld"
import { GuideLink } from "@/components/guides/guide-link"
import { Badge } from "@/components/ui/badge"
import { fetchPresets, formatBytes, type Preset } from "@/lib/api"
import { webAppJsonLd } from "@/lib/json-ld"
import {
  INDEX_SEO,
  PRESET_IDS,
  faqJsonLd,
  pageSeoHead,
  publicUrl,
} from "@/lib/preset-seo"

const INDEX_FAQ = [
  {
    q: "Which portals can I target?",
    a: "UK passport and visa photos, UKVI, EU Settlement, UCAS, SAAS, Student Finance England, HMRC, DVLA, NHS Jobs, Trac, Civil Service Jobs, Land Registry, Companies House, and more — plus generic JPG and PDF size caps from 100 KB to 2 MB.",
  },
  {
    q: "Is it free?",
    a: "Fixing one file is free. An evidence pack (several files, optionally merged into one PDF) is a one-off payment when Stripe is configured.",
  },
  {
    q: "Do you keep my file?",
    a: "Files are deleted 1 hour after processing. We never log file contents.",
  },
]

export const Route = createFileRoute("/fix/")({
  head: () =>
    pageSeoHead(
      INDEX_SEO.title,
      INDEX_SEO.description,
      "/fix",
      "/og/default.png"
    ),
  component: FixIndexPage,
})

/** Catalogue of portal presets. Fetched client-side so SSR does not need the API. */
function FixIndexPage() {
  const [presets, setPresets] = React.useState<Preset[] | null>(null)
  const [error, setError] = React.useState(false)

  React.useEffect(() => {
    let cancelled = false
    fetchPresets()
      .then((items) => {
        if (!cancelled) setPresets(items)
      })
      .catch(() => {
        if (!cancelled) setError(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const portals = presets?.filter((item) => item.source_url) ?? []
  const generics = presets?.filter((item) => !item.source_url) ?? []

  return (
    <div className="page-stack pb-8">
      <JsonLd payload={faqJsonLd(INDEX_FAQ)} />
      <JsonLd
        payload={webAppJsonLd(
          publicUrl("/fix"),
          "Chowbea upload fixer",
          INDEX_SEO.description
        )}
      />

      <div className="flex items-start gap-4">
        <span className="flex size-14 shrink-0 items-center justify-center rounded-[15px] border-2 border-ink bg-amber text-ink shadow-block-sm">
          <HugeiconsIcon
            icon={Image01Icon}
            className="size-7"
            strokeWidth={2.2}
          />
        </span>
        <div className="min-w-0">
          <h1 className="font-heading text-3xl leading-none font-extrabold tracking-tight text-ink uppercase sm:text-[44px]">
            {INDEX_SEO.h1}
          </h1>
          <p className="mt-1.5 max-w-xl text-[15px] font-semibold text-subtext">
            Pick a UK portal, drop a file, and we convert / resize / compress it
            to that portal&apos;s rules. One file is free. No account needed.
            Format only — not a guarantee of acceptance.{" "}
            <Link
              to="/portals"
              className="font-extrabold text-ink underline decoration-2 underline-offset-2"
            >
              Browse portals by category
            </Link>
            {" · "}
            <Link
              to="/guides"
              className="font-extrabold text-ink underline decoration-2 underline-offset-2"
            >
              How-to guides
            </Link>
            .
          </p>
        </div>
      </div>

      {error && (
        <p className="rounded-[16px] border-2 border-destructive bg-destructive/10 px-4 py-3 text-sm font-semibold text-destructive">
          Couldn&apos;t load presets. Is the API running?
        </p>
      )}

      {presets && (
        <>
          <PresetGroup title="UK portals" items={portals} />
          <PresetGroup title="Generic size targets" items={generics} />
        </>
      )}

      {!presets && (
        <ul className="grid gap-4 sm:grid-cols-2">
          {PRESET_IDS.map((id) => (
            <li key={id}>
              <Link
                to="/fix/$preset"
                params={{ preset: id }}
                className="press flex rounded-[20px] border-2 border-ink bg-card p-5 font-heading text-sm font-extrabold text-ink shadow-block-sm"
              >
                {id}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function PresetGroup({ title, items }: { title: string; items: Preset[] }) {
  if (items.length === 0) return null
  return (
    <section>
      <h2 className="mb-4 font-heading text-sm font-extrabold tracking-wide text-ink uppercase">
        {title}
      </h2>
      <div className="grid gap-4 sm:grid-cols-2">
        {items.map((preset) => (
          <div
            key={preset.id}
            className="flex flex-col gap-2 rounded-[20px] border-2 border-ink bg-card p-5 shadow-block-sm hover:bg-surface"
          >
            <Link
              to="/fix/$preset"
              params={{ preset: preset.id }}
              className="press group flex flex-col gap-2"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="font-heading text-base font-extrabold text-ink">
                  {preset.h1 || preset.name}
                </p>
                <span className="font-heading text-lg font-extrabold text-ink">
                  →
                </span>
              </div>
              <p className="text-[13px] font-semibold text-muted-ink">
                {preset.accepted_types
                  .map((type) => (type === "jpeg" ? "JPG" : type.toUpperCase()))
                  .join(" · ")}
                {preset.max_bytes
                  ? ` · max ${formatBytes(preset.max_bytes)}`
                  : ""}
              </p>
              <Badge variant={preset.verified ? "amber" : "outline"}>
                {preset.verified ? "Verified" : "Unverified"}
              </Badge>
            </Link>
            <GuideLink presetId={preset.id} />
          </div>
        ))}
      </div>
    </section>
  )
}
