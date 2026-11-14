import { Link } from "@tanstack/react-router"

import { UsageStatsNote } from "@/components/usage-stats-note"

/** Shared underline for the footer nav links. */
const FOOTER_LINK_CLASS = "underline decoration-2 underline-offset-2"

/**
 * Site-wide footer: brand, legal nav, and the anonymous usage-counter note.
 * Copy matches /privacy; the stats link is the public API JSON endpoint.
 */
export function SiteFooter() {
  return (
    <footer className="mt-14 flex flex-col gap-3 border-t-[3px] border-ink pt-6">
      <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
        <span className="font-heading text-sm font-extrabold text-ink">
          Chowbea Image — Bold Blocks
        </span>
        <span className="text-[13px] font-semibold text-muted-ink">
          Free &amp; ad-free · files deleted 1 hour after processing ·{" "}
          <Link to="/fix" className={FOOTER_LINK_CLASS}>
            Upload fixer
          </Link>
          {" · "}
          <Link to="/portals" className={FOOTER_LINK_CLASS}>
            UK portals
          </Link>
          {" · "}
          <Link to="/guides" className={FOOTER_LINK_CLASS}>
            Guides
          </Link>
          {" · "}
          <Link to="/privacy" className={FOOTER_LINK_CLASS}>
            Privacy
          </Link>
        </span>
      </div>
      <UsageStatsNote />
    </footer>
  )
}
