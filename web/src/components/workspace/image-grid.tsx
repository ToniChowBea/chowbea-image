import { AnimatePresence, motion } from "motion/react"

import { useWorkspace } from "@/stores/workspace"

import { Dropzone } from "./dropzone"
import { ImageCard } from "./image-card"

/**
 * The gallery: every workspace image as an `.image-card` tile in a
 * responsive grid, plus a compact "+ drop more" tile so an existing batch
 * can keep growing. Before anything has been added, renders the bold,
 * centered empty-state Dropzone instead. Cards fade/scale in and out on
 * add/remove rather than popping — `AnimatePresence` needs each card as a
 * direct, uniquely-keyed child to detect the unmount.
 */
export function ImageGrid() {
  const images = useWorkspace((state) => state.images)

  if (images.length === 0) {
    return <Dropzone />
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      <AnimatePresence initial={false}>
        {images.map((image) => (
          <motion.div
            key={image.id}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
          >
            <ImageCard image={image} />
          </motion.div>
        ))}
      </AnimatePresence>
      <Dropzone compact />
    </div>
  )
}
