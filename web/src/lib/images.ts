export const SUPPORTED_EXTS = new Set([
  "png",
  "jpg",
  "jpeg",
  "webp",
  "avif",
  "heic",
  "heif",
  "gif",
  "tif",
  "tiff",
  "bmp",
])

/** Browser-renderable formats. */
const BROWSER_RENDERABLE = new Set(["png", "jpg", "jpeg", "webp", "gif", "bmp", "avif"])

/**
 * Extract file extension (lowercase, with dot).
 */
export function extOf(name: string): string {
  const lastDot = name.lastIndexOf(".")
  if (lastDot === -1 || lastDot === name.length - 1) return ""
  return name.slice(lastDot).toLowerCase()
}

/**
 * Check if the image format can be rendered by browsers.
 * HEIC, HEIF, TIFF require conversion.
 */
export function isBrowserRenderable(name: string): boolean {
  const ext = extOf(name).slice(1) // Remove the dot
  return BROWSER_RENDERABLE.has(ext)
}

/**
 * Create a blob URL from a File (or any Blob, e.g. a job result).
 */
export function objectUrlFor(file: Blob): string {
  return URL.createObjectURL(file)
}

/**
 * Revoke a blob URL to free up memory.
 */
export function revokeUrl(url: string): void {
  URL.revokeObjectURL(url)
}

/**
 * Get a human-readable label for the image kind (e.g. "HEIC", "TIFF").
 */
export function kindLabel(name: string): string {
  return extOf(name).slice(1).toUpperCase()
}
