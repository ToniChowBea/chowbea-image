import { createFileRoute } from "@tanstack/react-router"

import { GuidesIndex } from "@/components/guides/guides-index"
import { GUIDES_SEO } from "@/lib/guides"
import { pageSeoHead } from "@/lib/preset-seo"

export const Route = createFileRoute("/guides/")({
  head: () =>
    pageSeoHead(
      GUIDES_SEO.title,
      GUIDES_SEO.description,
      "/guides",
      "/og/portals.png"
    ),
  component: GuidesIndexPage,
})

/** Server-rendered index of how-to guides, grouped like /portals. */
function GuidesIndexPage() {
  return <GuidesIndex />
}
