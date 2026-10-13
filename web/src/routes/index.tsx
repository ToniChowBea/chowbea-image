import { createFileRoute } from "@tanstack/react-router"

import { Dropzone } from "@/components/workspace/dropzone"
import { Workspace } from "@/components/workspace/workspace"
import { useWorkspace } from "@/stores/workspace"

export const Route = createFileRoute("/")({ component: Home })

function Home() {
  const hasImages = useWorkspace((state) => state.images.length > 0)

  if (!hasImages) {
    return (
      <div className="flex min-h-[60svh] flex-col items-center justify-center py-10">
        <Dropzone className="w-full max-w-2xl" />
      </div>
    )
  }

  return <Workspace />
}
