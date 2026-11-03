import * as React from "react"
import { createFileRoute } from "@tanstack/react-router"

import { JsonLd } from "@/components/fix/json-ld"
import { Landing } from "@/components/landing"
import { webAppJsonLd } from "@/lib/json-ld"
import { HOME_SEO, pageSeoHead, publicUrl } from "@/lib/preset-seo"
import { useWorkspace } from "@/stores/workspace"
import type { Workspace } from "@/components/workspace/workspace"

export const Route = createFileRoute("/")({
  head: () =>
    pageSeoHead(HOME_SEO.title, HOME_SEO.description, "/", "/og/default.png"),
  component: Home,
})

function Home() {
  const hasImages = useWorkspace((state) => state.images.length > 0)
  const [WorkspaceCmp, setWorkspaceCmp] =
    React.useState<typeof Workspace | null>(null)

  // Load the image workspace only after files land so the landing JS stays
  // small. Zustand images are client-only, so SSR always paints the landing.
  React.useEffect(() => {
    if (!hasImages || WorkspaceCmp) return
    let cancelled = false
    void import("@/components/workspace/workspace").then((mod) => {
      if (!cancelled) setWorkspaceCmp(() => mod.Workspace)
    })
    return () => {
      cancelled = true
    }
  }, [hasImages, WorkspaceCmp])

  return (
    <>
      <JsonLd
        payload={webAppJsonLd(
          publicUrl("/"),
          HOME_SEO.title,
          HOME_SEO.description
        )}
      />
      {hasImages && WorkspaceCmp ? <WorkspaceCmp /> : <Landing />}
    </>
  )
}
