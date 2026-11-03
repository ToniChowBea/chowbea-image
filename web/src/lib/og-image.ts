/**
 * Builds a 1200×630 Open Graph SVG in the Bold Blocks palette: cream field,
 * ink outline, amber mark, portal name, and the upload limit.
 */

import { ogCard } from "./og-copy"

export { isOgSlug, ogCard, OG_SLUGS } from "./og-copy"
export type { OgCard, OgSlug } from "./og-copy"

const OG_WIDTH = 1200
const OG_HEIGHT = 630
const FONT_FAMILY = "Bricolage Grotesque"

/** Escape user-facing strings before interpolating them into SVG. */
function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

/** Wrap a title so it fits the Open Graph canvas at display size. */
export function wrapOgTitle(text: string, maxChars = 22): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let current = ""
  for (const word of words) {
    const next = current ? `${current} ${word}` : word
    if (next.length > maxChars && current) {
      lines.push(current)
      current = word
    } else {
      current = next
    }
  }
  if (current) lines.push(current)
  return lines.slice(0, 3)
}

/** SVG for a preset (or the default / portals card) in chowbea-image colours. */
export function ogSvg(slug: string): string {
  const card = ogCard(slug)
  const lines = wrapOgTitle(card.name.toUpperCase())
  const title = lines
    .map(
      (line, index) =>
        `<text x="72" y="${232 + index * 70}" font-family="${FONT_FAMILY}" font-size="58" font-weight="800" fill="#211A12">${escapeXml(line)}</text>`
    )
    .join("")
  const badgeY = 232 + lines.length * 70 + 28
  const limit = escapeXml(card.limit.toUpperCase())
  const badgeWidth = Math.min(920, Math.max(280, limit.length * 28 + 64))

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${OG_WIDTH}" height="${OG_HEIGHT}" viewBox="0 0 ${OG_WIDTH} ${OG_HEIGHT}">
  <rect width="${OG_WIDTH}" height="${OG_HEIGHT}" fill="#fff3e2"/>
  <rect x="44" y="52" width="1112" height="538" rx="28" fill="#211A12"/>
  <rect x="36" y="44" width="1112" height="538" rx="28" fill="#fff3e2" stroke="#211A12" stroke-width="8"/>
  <rect x="72" y="80" width="88" height="88" rx="18" fill="#F2922B" stroke="#211A12" stroke-width="6"/>
  <rect x="92" y="104" width="48" height="40" rx="6" fill="none" stroke="#211A12" stroke-width="5"/>
  <circle cx="124" cy="118" r="5" fill="#211A12"/>
  <text x="180" y="118" font-family="${FONT_FAMILY}" font-size="22" font-weight="800" fill="#C0701A" letter-spacing="4">CHOWBEA IMAGE</text>
  <text x="180" y="148" font-family="${FONT_FAMILY}" font-size="20" font-weight="800" fill="#211A12">UPLOAD-LIMIT FIXER</text>
  ${title}
  <rect x="72" y="${badgeY}" width="${badgeWidth}" height="64" rx="32" fill="#F2922B" stroke="#211A12" stroke-width="4"/>
  <text x="${72 + badgeWidth / 2}" y="${badgeY + 44}" text-anchor="middle" font-family="${FONT_FAMILY}" font-size="28" font-weight="800" fill="#211A12">${limit}</text>
  <text x="72" y="540" font-family="${FONT_FAMILY}" font-size="20" font-weight="800" fill="#5B5043">FREE · FILES DELETED AFTER 1 HOUR</text>
</svg>`
}
