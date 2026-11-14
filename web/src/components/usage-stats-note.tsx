import type { ReactNode } from "react"

import { usageStatsUrl } from "@/lib/usage-stats"

/** Shared link classes so footer and /privacy look like the other legal links. */
const STATS_LINK_CLASS = "underline decoration-2 underline-offset-2"

/**
 * Anchor to the public GET /stats JSON on the API host.
 * Opens in a new tab so the current page stays put.
 */
export function UsageStatsLink({
  children = "/stats",
}: {
  children?: ReactNode
}) {
  return (
    <a
      href={usageStatsUrl()}
      target="_blank"
      rel="noreferrer"
      className={STATS_LINK_CLASS}
      aria-label="Public per-preset usage stats JSON"
    >
      {children}
    </a>
  )
}

/**
 * Short note matching /privacy: anonymous per-preset totals only,
 * published as public JSON at /stats.
 */
export function UsageStatsNote() {
  return (
    <p className="text-center text-[13px] font-semibold text-muted-ink sm:text-left">
      We keep anonymous per-preset totals — no filenames, IPs, or cookies.{" "}
      Public JSON: <UsageStatsLink>/stats</UsageStatsLink>.
    </p>
  )
}
