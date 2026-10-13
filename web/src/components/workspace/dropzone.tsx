import * as React from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { ImageAdd02Icon, Upload04Icon } from "@hugeicons/core-free-icons"

import { cn } from "@/lib/utils"
import { extOf, SUPPORTED_EXTS } from "@/lib/images"
import { useWorkspace } from "@/stores/workspace"

const ACCEPT = [...SUPPORTED_EXTS].map((ext) => `.${ext}`).join(",")

/** Keep files whose extension is in `accept` (or the default image set). */
function pickSupported(files: FileList | null, accept?: string): File[] {
  if (!files) return []
  const allowed = accept
    ? new Set(
        accept
          .split(",")
          .map((part) => part.trim().replace(/^\./, "").toLowerCase())
      )
    : SUPPORTED_EXTS
  return Array.from(files).filter((file) =>
    allowed.has(extOf(file.name).slice(1))
  )
}

/**
 * Drag-and-drop / click-to-browse intake. Defaults to the workspace store;
 * pass `onFiles` to keep dropped files on a dedicated page (e.g. /fix).
 */
export function Dropzone({
  compact = false,
  className,
  accept,
  title,
  hint,
  multiple = true,
  onFiles,
}: {
  compact?: boolean
  className?: string
  accept?: string
  title?: string
  hint?: string
  multiple?: boolean
  onFiles?: (files: File[]) => void
}) {
  const addFiles = useWorkspace((state) => state.addFiles)
  const [isDragging, setIsDragging] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement>(null)

  function handleFiles(files: FileList | null) {
    const picked = pickSupported(files, accept)
    if (picked.length === 0) return
    if (onFiles) onFiles(picked)
    else addFiles(picked)
  }

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={title ?? "Add images"}
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
        compact
          ? // Stretch to the gallery row height (thumbnail + caption) so the
            // "Drop more" tile lines up with neighbouring image cards.
            "h-full min-h-0 gap-2 p-3"
          : "min-h-[280px] gap-4 px-6 py-14",
        isDragging
          ? "border-ink bg-soft-amber/60"
          : "border-[#c9b89c] bg-card hover:bg-surface",
        className
      )}
    >
      <input
        ref={inputRef}
        type="file"
        multiple={multiple}
        accept={accept ?? ACCEPT}
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
        <p className="text-xs font-extrabold tracking-wide text-muted-ink uppercase">
          Drop more
        </p>
      ) : (
        <>
          <div>
            <p className="font-heading text-xl font-extrabold text-ink">
              {title ?? "Drop images here"}
            </p>
            <p className="mt-1 text-[13px] font-bold tracking-wide text-muted-ink uppercase">
              {hint ?? "PNG, JPG, WEBP, AVIF, HEIC, GIF, TIFF, BMP"}
            </p>
          </div>
          <span className="pointer-events-none inline-flex items-center gap-2 rounded-full border-2 border-ink bg-card px-4 py-1.5 text-[13px] font-extrabold tracking-wide text-ink uppercase shadow-block-sm">
            Browse files
          </span>
        </>
      )}
    </div>
  )
}
