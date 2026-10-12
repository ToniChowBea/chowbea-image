import { createFileRoute, Link } from "@tanstack/react-router"
import * as React from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { Image01Icon } from "@hugeicons/core-free-icons"

import { Badge } from "@/components/ui/badge"
import { fetchPresets, formatBytes, type Preset } from "@/lib/api"

export const Route = createFileRoute("/fix")({ component: FixIndexPage })

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
    <div className="pb-8">
      <div className="mt-8 flex items-center gap-4">
        <span className="flex size-14 shrink-0 items-center justify-center rounded-[15px] border-2 border-ink bg-amber text-ink shadow-block-sm">
          <HugeiconsIcon icon={Image01Icon} className="size-7" strokeWidth={2.2} />
        </span>
        <div>
          <h1 className="font-heading text-3xl font-extrabold uppercase leading-none tracking-tight text-ink sm:text-[44px]">
            Upload fixer
          </h1>
          <p className="mt-1.5 max-w-xl text-[15px] font-semibold text-subtext">
            Pick a UK portal, drop a file, and we convert / resize / compress it to that portal&apos;s
            rules. Format only — not a guarantee of acceptance.
          </p>
        </div>
      </div>

      {error && (
        <p className="mt-8 rounded-[12px] border-2 border-destructive bg-destructive/10 px-4 py-3 text-sm font-semibold text-destructive">
          Couldn&apos;t load presets. Is the API running?
        </p>
      )}

      {presets && (
        <>
          <PresetGroup title="UK portals" items={portals} />
          <PresetGroup title="Generic size targets" items={generics} />
        </>
      )}
    </div>
  )
}

function PresetGroup({ title, items }: { title: string; items: Preset[] }) {
  if (items.length === 0) return null
  return (
    <section className="mt-10">
      <h2 className="mb-4 font-heading text-sm font-extrabold uppercase tracking-wide text-ink">
        {title}
      </h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {items.map((preset) => (
          <Link
            key={preset.id}
            to="/fix/$preset"
            params={{ preset: preset.id }}
            className="press group flex flex-col gap-2 rounded-[16px] border-2 border-ink bg-card p-4 shadow-block-sm hover:bg-surface"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="font-heading text-base font-extrabold text-ink">{preset.name}</p>
              <span className="font-heading text-lg font-extrabold text-ink">→</span>
            </div>
            <p className="text-[13px] font-semibold text-muted-ink">
              {preset.accepted_types.map((type) => (type === "jpeg" ? "JPG" : type.toUpperCase())).join(" · ")}
              {preset.max_bytes ? ` · max ${formatBytes(preset.max_bytes)}` : ""}
            </p>
            <Badge variant={preset.verified ? "amber" : "outline"}>
              {preset.verified ? "Verified" : "Unverified"}
            </Badge>
          </Link>
        ))}
      </div>
    </section>
  )
}
