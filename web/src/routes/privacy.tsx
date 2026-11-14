import { createFileRoute } from "@tanstack/react-router"

import { PrivacyPage } from "@/components/privacy-page"
import { PRIVACY_SEO, pageSeoHead } from "@/lib/preset-seo"

export const Route = createFileRoute("/privacy")({
  head: () =>
    pageSeoHead(PRIVACY_SEO.title, PRIVACY_SEO.description, "/privacy"),
  component: PrivacyPage,
})
