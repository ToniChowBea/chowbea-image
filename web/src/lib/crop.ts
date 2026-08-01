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
    cropW = Math.round((h * ratioW) / ratioH)
  } else {
    cropW = w
    cropH = Math.round((w * ratioH) / ratioW)
  }

  const x = Math.floor((w - cropW) / 2)
  const y = Math.floor((h - cropH) / 2)

  return { x, y, width: cropW, height: cropH }
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
