import { createFileRoute } from "@tanstack/react-router"

import { Landing } from "@/components/landing"
import { Workspace } from "@/components/workspace/workspace"
import { HOME_SEO, pageSeoHead } from "@/lib/preset-seo"
import { useWorkspace } from "@/stores/workspace"

export const Route = createFileRoute("/")({
  head: () => pageSeoHead(HOME_SEO.title, HOME_SEO.description, "/"),
  component: Home,
})

function Home() {
  const hasImages = useWorkspace((state) => state.images.length > 0)

  // Empty visit: marketing landing. Once images land in the store (from the
  // landing drop/picker), the existing workspace takes over unchanged.
  if (!hasImages) {
    return <Landing />
  }

  return <Workspace />
}
