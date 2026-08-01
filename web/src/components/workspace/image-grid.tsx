import { useWorkspace } from "@/stores/workspace"

import { Dropzone } from "./dropzone"
import { ImageCard } from "./image-card"

/**
 * The gallery: every workspace image as an `.image-card` tile in a
 * responsive grid, plus a compact "+ drop more" tile so an existing batch
 * can keep growing. Before anything has been added, renders the bold,
 * centered empty-state Dropzone instead.
 */
export function ImageGrid() {
  const images = useWorkspace((state) => state.images)

  if (images.length === 0) {
    return <Dropzone />
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {images.map((image) => (
        <ImageCard key={image.id} image={image} />
      ))}
      <Dropzone compact />
    </div>
  )
}
