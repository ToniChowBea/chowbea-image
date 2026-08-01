import * as React from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { ImageAdd02Icon, Upload04Icon } from "@hugeicons/core-free-icons"

import { cn } from "@/lib/utils"
import { extOf, SUPPORTED_EXTS } from "@/lib/images"
import { useWorkspace } from "@/stores/workspace"

const ACCEPT = [...SUPPORTED_EXTS].map((ext) => `.${ext}`).join(",")

function pickSupported(files: FileList | null): File[] {
  if (!files) return []
  return Array.from(files).filter((file) => SUPPORTED_EXTS.has(extOf(file.name).slice(1)))
}

/**
 * Drag-and-drop / click-to-browse image intake, self-contained against the
 * workspace store. `compact` renders the small "+ drop more" tile that sits
 * at the end of a populated ImageGrid; the default is the bold, centered
 * empty-state well shown before any image has been added.
 */
export function Dropzone({ compact = false, className }: { compact?: boolean; className?: string }) {
  const addFiles = useWorkspace((state) => state.addFiles)
  const [isDragging, setIsDragging] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement>(null)

  function handleFiles(files: FileList | null) {
    const picked = pickSupported(files)
    if (picked.length > 0) addFiles(picked)
  }

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Add images"
      onClick={() => inputRef.current?.click()}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault()
          inputRef.current?.click()
        }
      }}
      onDragOver={(event) => {
        event.preventDefault()
        setIsDragging(true)
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(event) => {
        event.preventDefault()
        setIsDragging(false)
        handleFiles(event.dataTransfer.files)
      }}
      className={cn(
        "flex cursor-pointer flex-col items-center justify-center rounded-[20px] border-[3px] border-dashed text-center transition-colors",
        compact ? "min-h-[220px] gap-2 p-4" : "min-h-[280px] gap-4 px-6 py-14",
        isDragging ? "border-ink bg-soft-amber/60" : "border-[#c9b89c] bg-card hover:bg-surface",
        className
      )}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPT}
        className="hidden"
        onChange={(event) => {
          handleFiles(event.target.files)
          event.target.value = ""
        }}
      />
      <span
        className={cn(
          "flex items-center justify-center rounded-[16px] border-2 border-ink bg-amber text-ink shadow-block-sm",
          compact ? "size-10" : "size-16"
        )}
      >
        <HugeiconsIcon
          icon={compact ? ImageAdd02Icon : Upload04Icon}
          className={compact ? "size-5" : "size-8"}
          strokeWidth={2.2}
        />
      </span>
      {compact ? (
        <p className="text-xs font-extrabold uppercase tracking-wide text-muted-ink">Drop more</p>
      ) : (
        <>
          <div>
            <p className="font-heading text-xl font-extrabold text-ink">Drop images here</p>
            <p className="mt-1 text-[13px] font-bold uppercase tracking-wide text-muted-ink">
              PNG, JPG, WEBP, AVIF, HEIC, GIF, TIFF, BMP
            </p>
          </div>
          <span className="pointer-events-none inline-flex items-center gap-2 rounded-full border-2 border-ink bg-card px-4 py-1.5 text-[13px] font-extrabold uppercase tracking-wide text-ink shadow-block-sm">
            Browse files
          </span>
        </>
      )}
    </div>
  )
}
