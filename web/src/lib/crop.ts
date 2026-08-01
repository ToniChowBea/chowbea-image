export const ASPECTS = {
  "1:1": [1, 1],
  "4:3": [4, 3],
  "16:9": [16, 9],
  "9:16": [9, 16],
} as const

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

/**
 * Banker's rounding (round-half-to-even), matching Python 3's round().
 * Ensures client crop preview matches server crop output exactly.
 */
function pyRound(x: number): number {
  const floor = Math.floor(x)
  const diff = x - floor
  if (diff < 0.5) return floor
  if (diff > 0.5) return floor + 1
  // exact .5 → round to even
  return floor % 2 === 0 ? floor : floor + 1
}

/**
 * Largest rectangle of ratio_w:ratio_h that fits in w×h, centered.
 * Mirrors the API's _centered_box function.
 */
export function centeredBox(
  w: number,
  h: number,
  ratioW: number,
  ratioH: number,
): Rect {
  let cropH: number
  let cropW: number

  if (w * ratioH >= h * ratioW) {
    cropH = h
    cropW = pyRound((h * ratioW) / ratioH)
  } else {
    cropW = w
    cropH = pyRound((w * ratioH) / ratioW)
  }

  const x = Math.floor((w - cropW) / 2)
  const y = Math.floor((h - cropH) / 2)

  return { x, y, width: cropW, height: cropH }
}

/**
 * Scales a rect from one pixel-coordinate space to another — e.g. a crop box
 * drawn on a downscaled <img> preview (display space) mapped to the image's
 * full-resolution pixels (natural space), or the reverse (swap the args).
 * Rounds to integers.
 */
export function scaleRect(
  rect: Rect,
  from: { width: number; height: number },
  to: { width: number; height: number },
): Rect {
  const scaleX = to.width / from.width
  const scaleY = to.height / from.height
  return {
    x: Math.round(rect.x * scaleX),
    y: Math.round(rect.y * scaleY),
    width: Math.round(rect.width * scaleX),
    height: Math.round(rect.height * scaleY),
  }
}

/**
 * Converts a crop box drawn in on-screen display pixels (an `<img>`'s
 * rendered `clientWidth`/`clientHeight`) to the image's natural
 * (full-resolution) pixel coordinates (`naturalWidth`/`naturalHeight`) —
 * what the API expects for `mode=rect` crops.
 */
export function displayToNaturalRect(
  rect: Rect,
  displaySize: { width: number; height: number },
  naturalSize: { width: number; height: number },
): Rect {
  return scaleRect(rect, displaySize, naturalSize)
}

/**
 * Clamp rect to stay within bounds, ensuring minimum 1px dimensions.
 */
export function clampRect(rect: Rect, bounds: { width: number; height: number }): Rect {
  let { x, y, width, height } = rect
  const { width: maxW, height: maxH } = bounds

  // Ensure non-negative position
  x = Math.max(0, x)
  y = Math.max(0, y)

  // Clamp width and height to fit within bounds
  width = Math.min(width, maxW - x)
  height = Math.min(height, maxH - y)

  // Ensure minimum 1px
  width = Math.max(1, width)
  height = Math.max(1, height)

  // If clamping dimensions pushed us outside bounds, move the rect
  if (x + width > maxW) {
    x = Math.max(0, maxW - width)
  }
  if (y + height > maxH) {
    y = Math.max(0, maxH - height)
  }

  return { x, y, width, height }
}
