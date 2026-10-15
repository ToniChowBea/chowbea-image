import * as React from "react"
import { Link } from "@tanstack/react-router"
import { motion } from "motion/react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowRight02Icon,
  Passport01Icon,
  Upload04Icon,
} from "@hugeicons/core-free-icons"

import { CoffeeBlock } from "@/components/coffee-block"
import { TOOLS } from "@/components/workspace/toolbar"
import { SUPPORTED_ACCEPT, isSupportedImage } from "@/lib/images"
import { cn } from "@/lib/utils"
import { useWorkspace } from "@/stores/workspace"
import type { ToolName } from "@/stores/workspace"

// A crisp ease-out-quart for the tile entrance.
const EASE_OUT_QUART = [0.22, 1, 0.36, 1] as [number, number, number, number]

/** One-line pitch for each workspace tool, shown on the landing tiles. */
const TOOL_BLURBS: Record<ToolName, string> = {
  convert: "HEIC, PNG, JPG, WebP…",
  compress: "Shrink file size",
  resize: "Pixels, percent, presets",
  rotate: "90° turns & flips",
  crop: "Aspect or freeform",
}

const PORTAL_CHIPS = [
  "UK passport",
  "UCAS",
  "SAAS",
  "UKVCAS",
  "VFS",
  "NHS Jobs",
]

/** Collect supported images from a picker or a drop and add them to the workspace. */
function addIncoming(incoming: FileList | File[] | null) {
  if (!incoming) return
  const supported = Array.from(incoming).filter(isSupportedImage)
  if (supported.length === 0) return
  useWorkspace.getState().addFiles(supported)
}

function hasFileDrag(event: React.DragEvent) {
  return Array.from(event.dataTransfer.types).includes("Files")
}

/**
 * Amber tool tile. Always selects the workspace tool. With no images yet,
 * also opens the native file picker so choosing files lands in that panel —
 * Image has one workspace rather than PDF-style per-tool routes.
 */
function ToolTile({
  id,
  label,
  description,
  icon,
  index,
  selected,
  onPick,
}: {
  id: ToolName
  label: string
  description: string
  icon: (typeof TOOLS)[number]["icon"]
  index: number
  selected: boolean
  onPick: () => void
}) {
  return (
    <button
      type="button"
      onClick={() => {
        const store = useWorkspace.getState()
        store.setActiveTool(id)
        // Empty landing only: files already in the store mean the parent
        // route will swap to the workspace with this tool active.
        if (store.images.length === 0) {
          onPick()
        }
      }}
      aria-pressed={selected}
      className={cn(
        "group flex flex-col rounded-[18px] border-2 border-ink bg-amber p-6 text-left shadow-block transition-[transform,box-shadow]",
        "hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-block-lg",
        "active:translate-x-[5px] active:translate-y-[5px] active:shadow-none",
        selected && "ring-4 ring-ink/15"
      )}
    >
      <motion.div
        className="flex h-full flex-col gap-4"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{
          duration: 0.4,
          delay: 0.1 + index * 0.05,
          ease: EASE_OUT_QUART,
        }}
      >
        <div className="flex items-start justify-between">
          <span className="flex size-[52px] items-center justify-center rounded-[13px] border-2 border-ink bg-surface text-ink">
            <HugeiconsIcon
              icon={icon}
              className="size-[26px]"
              strokeWidth={2.2}
            />
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-ink px-2.5 py-1 text-[10px] font-extrabold tracking-[0.15em] text-cream uppercase">
            <span className="size-1.5 rounded-full bg-amber" />
            {selected ? "Selected" : "Active"}
          </span>
        </div>

        <div className="mt-auto">
          <div className="flex items-center gap-2">
            <h3 className="font-heading text-[22px] font-extrabold text-ink">
              {label}
            </h3>
            <HugeiconsIcon
              icon={ArrowRight02Icon}
              className="size-5 -translate-x-1.5 text-ink opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100"
              strokeWidth={2.4}
            />
          </div>
          <p className="mt-1 text-sm font-semibold text-[#5a4324]">
            {description}
          </p>
        </div>
      </motion.div>
    </button>
  )
}

/** Full-width UK-portal fixer card — the featured path off the landing page. */
function FixFeature() {
  return (
    <Link
      to="/fix"
      aria-label="Fix for a UK portal"
      className="group mt-11 flex flex-col gap-5 rounded-[22px] border-2 border-ink bg-ink p-6 text-cream shadow-amber-lg transition-[transform,box-shadow] hover:-translate-x-0.5 hover:-translate-y-0.5 sm:flex-row sm:items-center sm:gap-8 sm:p-8"
    >
      <span className="flex size-[72px] shrink-0 items-center justify-center rounded-[18px] border-2 border-ink bg-amber text-ink">
        <HugeiconsIcon
          icon={Passport01Icon}
          className="size-9"
          strokeWidth={2.2}
        />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber px-2.5 py-1 text-[10px] font-extrabold tracking-[0.15em] text-ink uppercase">
            <span className="size-1.5 rounded-full bg-ink" />
            New
          </span>
          <span className="text-[13px] font-extrabold tracking-wide text-amber uppercase">
            UK portals
          </span>
        </div>
        <h2 className="mt-2 font-heading text-[28px] leading-none font-extrabold tracking-tight text-cream uppercase sm:text-[32px]">
          Fix for a UK portal
        </h2>
        <p className="mt-2 max-w-xl text-[15px] font-semibold text-[#c9b89c]">
          Passport photos, UCAS, SAAS, UKVCAS, VFS, NHS Jobs — convert, resize
          and compress to that portal&apos;s rules. One file is free.
        </p>
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {PORTAL_CHIPS.map((chip) => (
            <li
              key={chip}
              className="rounded-full border border-[#5a4a35] px-2.5 py-1 text-[11px] font-extrabold tracking-wide text-cream uppercase"
            >
              {chip}
            </li>
          ))}
        </ul>
      </div>

      <span className="press inline-flex shrink-0 items-center gap-2.5 self-start rounded-full border-2 border-ink bg-amber px-6 py-3.5 font-heading text-base font-extrabold tracking-wide text-ink uppercase shadow-[4px_4px_0_var(--cream)] sm:self-center">
        Fix a file
        <HugeiconsIcon
          icon={ArrowRight02Icon}
          className="size-5"
          strokeWidth={2.4}
        />
      </span>
    </Link>
  )
}

/**
 * Empty-state homepage: hero, featured UK-portal fixer, five image-tool tiles,
 * then the coffee ask. A tile click opens the native picker (or selects the
 * tool if images are already loaded). Dropping files (button or anywhere on
 * this surface) adds them to the workspace store so the index route can swap
 * in the existing workspace.
 */
export function Landing() {
  const activeTool = useWorkspace((state) => state.activeTool)
  const [dragDepth, setDragDepth] = React.useState(0)
  const inputRef = React.useRef<HTMLInputElement>(null)

  // Shared opener for the Upload button and tool tiles.
  function openPicker() {
    inputRef.current?.click()
  }

  // A drag can end without a paired dragleave at this root (released outside
  // the window, focus loss). Reset the counter on any global drag end/drop.
  React.useEffect(() => {
    const reset = () => setDragDepth(0)
    window.addEventListener("dragend", reset)
    window.addEventListener("drop", reset)
    return () => {
      window.removeEventListener("dragend", reset)
      window.removeEventListener("drop", reset)
    }
  }, [])

  return (
    <div
      data-testid="landing"
      className="relative pt-10 sm:pt-12"
      onDragEnter={(event) => {
        if (!hasFileDrag(event)) return
        event.preventDefault()
        setDragDepth((depth) => depth + 1)
      }}
      onDragOver={(event) => {
        if (hasFileDrag(event)) event.preventDefault()
      }}
      onDragLeave={(event) => {
        if (!hasFileDrag(event)) return
        setDragDepth((depth) => Math.max(0, depth - 1))
      }}
      onDrop={(event) => {
        if (!hasFileDrag(event)) return
        event.preventDefault()
        setDragDepth(0)
        addIncoming(event.dataTransfer.files)
      }}
    >
      {dragDepth > 0 && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-[24px] border-4 border-dashed border-ink bg-cream/90">
          <span className="font-heading text-2xl font-extrabold tracking-tight text-ink uppercase">
            Drop files anywhere
          </span>
        </div>
      )}

      {/* Hero: what this is, then how to start. */}
      <div className="flex flex-col items-start justify-between gap-8 lg:flex-row lg:items-center">
        <h1 className="font-heading text-[44px] leading-[0.98] font-extrabold tracking-tight text-ink uppercase sm:text-[58px] lg:text-[62px]">
          Pick a tool.
          <br />
          <span
            className="text-amber"
            style={{ WebkitTextStroke: "2px #211A12" }}
          >
            Drop an image.
          </span>
        </h1>

        <div className="flex max-w-[330px] flex-col items-start gap-4 lg:items-end">
          <p className="text-[17px] leading-snug font-semibold text-subtext lg:text-right">
            {activeTool
              ? `${TOOLS.find((tool) => tool.id === activeTool)?.label} is ready — drop files anywhere.`
              : "Click Upload images or drag and drop files anywhere to get started."}
          </p>
          <button
            type="button"
            onClick={openPicker}
            className="press inline-flex items-center gap-2.5 rounded-full border-2 border-ink bg-ink px-7 py-3.5 font-heading text-base font-extrabold tracking-wide text-cream uppercase shadow-amber-sm active:translate-x-[4px] active:translate-y-[4px] active:shadow-none"
          >
            <HugeiconsIcon
              icon={Upload04Icon}
              className="size-5"
              strokeWidth={2.2}
            />
            Upload images
          </button>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={SUPPORTED_ACCEPT}
            className="hidden"
            onChange={(event) => {
              addIncoming(event.target.files)
              event.target.value = ""
            }}
          />
        </div>
      </div>

      <FixFeature />

      {/* Image toolkit — same five tools as the workspace toolbar. */}
      <div className="mt-11 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {TOOLS.map((tool, index) => (
          <ToolTile
            key={tool.id}
            id={tool.id}
            label={tool.label}
            description={TOOL_BLURBS[tool.id]}
            icon={tool.icon}
            index={index}
            selected={activeTool === tool.id}
            onPick={openPicker}
          />
        ))}
      </div>

      <CoffeeBlock />
      <p className="mt-6 text-center text-[15px] font-semibold text-muted-ink">
        No accounts, no clutter — convert, compress, resize, rotate, crop, or
        fix a file for a UK portal.
      </p>
    </div>
  )
}
