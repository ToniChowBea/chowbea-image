import { useCallback, useEffect, useRef, useState, type RefObject } from "react"

import type { CropRect } from "@/lib/api"
import { clampRect, scaleRect, type Rect } from "@/lib/crop"
import { cn } from "@/lib/utils"

type Size = { width: number; height: number }

/**
 * Measures an `<img>`'s natural (full-resolution) and display (rendered)
 * pixel size, re-measuring on load and on window resize. Shared by the
 * freeform `CropOverlay` box and the aspect-mode centered-crop preview so
 * both draw against the same displayed pixel grid the API's `mode=rect`
 * needs to be told about.
 */
export function useImageDisplaySize(imgRef: RefObject<HTMLImageElement | null>) {
  const [natural, setNatural] = useState<Size | null>(null)
  const [display, setDisplay] = useState<Size | null>(null)

  const measure = useCallback(() => {
    const img = imgRef.current
    if (!img || !img.naturalWidth) return
    setNatural({ width: img.naturalWidth, height: img.naturalHeight })
    setDisplay({ width: img.clientWidth, height: img.clientHeight })
  }, [imgRef])

  useEffect(() => {
    // Covers the case where the <img> is already decoded/cached by the time
    // this effect runs (its "load" event fired before we attached a
    // listener) — common for a blob URL already shown elsewhere in the app.
    measure()
    window.addEventListener("resize", measure)
    return () => window.removeEventListener("resize", measure)
  }, [measure])

  return { natural, display, onLoad: measure }
}

const MIN_BOX = 32 // display px — keeps every handle grabbable at any size

type DragMode = "move" | "nw" | "ne" | "sw" | "se"

interface DragState {
  mode: DragMode
  startX: number
  startY: number
  startBox: Rect
}

const HANDLES: { id: "nw" | "ne" | "sw" | "se"; position: string; cursor: string }[] = [
  { id: "nw", position: "-left-[7px] -top-[7px]", cursor: "nwse-resize" },
  { id: "ne", position: "-right-[7px] -top-[7px]", cursor: "nesw-resize" },
  { id: "sw", position: "-left-[7px] -bottom-[7px]", cursor: "nesw-resize" },
  { id: "se", position: "-right-[7px] -bottom-[7px]", cursor: "nwse-resize" },
]

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

/** Translate the box, stopping (not shrinking) at the image edges. */
export function moveRect(start: Rect, dx: number, dy: number, bounds: Size): Rect {
  return {
    ...start,
    x: clamp(start.x + dx, 0, bounds.width - start.width),
    y: clamp(start.y + dy, 0, bounds.height - start.height),
  }
}

/**
 * Resize from one corner, keeping the opposite corner anchored in place
 * (the behavior every crop tool uses) and never letting the box invert or
 * cross the image bounds.
 */
export function resizeRect(
  mode: "nw" | "ne" | "sw" | "se",
  start: Rect,
  dx: number,
  dy: number,
  bounds: Size
): Rect {
  const left =
    mode === "nw" || mode === "sw" ? clamp(start.x + dx, 0, start.x + start.width - MIN_BOX) : start.x
  const right =
    mode === "ne" || mode === "se"
      ? clamp(start.x + start.width + dx, start.x + MIN_BOX, bounds.width)
      : start.x + start.width
  const top =
    mode === "nw" || mode === "ne" ? clamp(start.y + dy, 0, start.y + start.height - MIN_BOX) : start.y
  const bottom =
    mode === "sw" || mode === "se"
      ? clamp(start.y + start.height + dy, start.y + MIN_BOX, bounds.height)
      : start.y + start.height
  return { x: left, y: top, width: right - left, height: bottom - top }
}

interface CropOverlayProps {
  src: string
  alt: string
  /** The rect last saved in the store (natural px) — seeds the box once on mount, then this component owns position/size until unmount. */
  initialRect: CropRect | null
  /** Fired with the box in natural px: once to seed a default rect, then again after every completed drag. */
  onRectChange: (rect: CropRect) => void
}

/**
 * A draggable, resizable crop box overlaid on a single previewed image.
 * The box lives in on-screen display pixels internally (so dragging tracks
 * the pointer 1:1) and is converted to the image's natural pixel resolution
 * — via `scaleRect` — only when reporting a finished drag up to the caller.
 */
export function CropOverlay({ src, alt, initialRect, onRectChange }: CropOverlayProps) {
  const imgRef = useRef<HTMLImageElement>(null)
  const { natural, display, onLoad } = useImageDisplaySize(imgRef)
  const [box, setBox] = useState<Rect | null>(null)
  const dragRef = useRef<DragState | null>(null)
  const prevDisplayRef = useRef<Size | null>(null)

  // Seed the box once sizes are known: from the stored rect (scaled into
  // this image's display size) if there is one, otherwise a centered
  // default — which is then reported up so the store always has a rect to
  // submit once sizes are known, even if the user never drags anything.
  useEffect(() => {
    if (!natural || !display || box) return
    if (initialRect) {
      setBox(scaleRect(initialRect, natural, display))
    } else {
      const width = Math.round(display.width * 0.8)
      const height = Math.round(display.height * 0.8)
      const seeded: Rect = {
        x: Math.round((display.width - width) / 2),
        y: Math.round((display.height - height) / 2),
        width,
        height,
      }
      setBox(seeded)
      onRectChange(clampRect(scaleRect(seeded, display, natural), natural))
    }
  }, [natural, display, initialRect, box, onRectChange])

  // Window resize changes the display size without changing the image —
  // rescale the box proportionally rather than re-deriving from the
  // (unchanged) natural rect, so an in-progress drag isn't clobbered.
  useEffect(() => {
    if (!display) return
    const prev = prevDisplayRef.current
    prevDisplayRef.current = display
    if (!prev || (prev.width === display.width && prev.height === display.height)) return
    setBox((current) => (current ? scaleRect(current, prev, display) : current))
  }, [display])

  function startDrag(mode: DragMode, event: React.PointerEvent<HTMLDivElement>) {
    if (!box) return
    event.preventDefault()
    event.stopPropagation()
    ;(event.currentTarget as HTMLDivElement).setPointerCapture(event.pointerId)
    dragRef.current = { mode, startX: event.clientX, startY: event.clientY, startBox: box }
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current
    if (!drag || !display) return
    const dx = event.clientX - drag.startX
    const dy = event.clientY - drag.startY
    const next =
      drag.mode === "move"
        ? moveRect(drag.startBox, dx, dy, display)
        : resizeRect(drag.mode, drag.startBox, dx, dy, display)
    setBox(next)
  }

  function endDrag(event: React.PointerEvent<HTMLDivElement>) {
    if (!dragRef.current) return
    dragRef.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    if (box && natural && display) {
      onRectChange(clampRect(scaleRect(box, display, natural), natural))
    }
  }

  const naturalBox = box && natural && display ? scaleRect(box, display, natural) : null

  return (
    <div className="checkerboard relative inline-block max-w-full overflow-hidden rounded-[14px] border-2 border-line">
      <img
        ref={imgRef}
        src={src}
        alt={alt}
        draggable={false}
        onLoad={onLoad}
        className="block max-h-[320px] w-auto max-w-full touch-none select-none"
      />
      {box && (
        <div
          role="group"
          aria-label="Crop box — drag to move, drag a corner to resize"
          className="absolute cursor-move touch-none border-2 border-amber [box-shadow:0_0_0_9999px_color-mix(in_oklch,var(--ink)_45%,transparent)]"
          style={{ left: box.x, top: box.y, width: box.width, height: box.height }}
          onPointerDown={(e) => startDrag("move", e)}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          {naturalBox && (
            <span className="pointer-events-none absolute -bottom-7 left-0 rounded-md border-2 border-ink bg-card px-1.5 py-0.5 text-[11px] font-bold whitespace-nowrap text-ink shadow-block-sm">
              {naturalBox.width} × {naturalBox.height}px
            </span>
          )}
          {HANDLES.map((handle) => (
            <div
              key={handle.id}
              role="presentation"
              className={cn(
                "absolute size-3.5 touch-none rounded-full border-2 border-ink bg-cream shadow-block-sm",
                handle.position
              )}
              style={{ cursor: handle.cursor }}
              onPointerDown={(e) => startDrag(handle.id, e)}
              onPointerMove={onPointerMove}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
            />
          ))}
        </div>
      )}
    </div>
  )
}
