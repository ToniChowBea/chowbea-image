/**
 * Rasterises Open Graph SVGs with a vendored ExtraBold TTF.
 * Used by the build script only — the Alpine production image serves the
 * PNGs from public/og and never loads this native module.
 */

import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

import { Resvg } from "@resvg/resvg-js"

import { ogSvg } from "./og-image"

const OG_WIDTH = 1200
const FONT_FAMILY = "Bricolage Grotesque"
const FONT_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  "../assets/bricolage-extrabold.ttf"
)

const pngCache = new Map<string, Uint8Array>()

/** Rasterise the card to PNG. Repeat calls for the same slug reuse the buffer. */
export async function renderOgPng(slug: string): Promise<Uint8Array> {
  const cached = pngCache.get(slug)
  if (cached) return cached
  const resvg = new Resvg(ogSvg(slug), {
    fitTo: { mode: "width", value: OG_WIDTH },
    font: {
      fontFiles: [FONT_PATH],
      loadSystemFonts: false,
      defaultFontFamily: FONT_FAMILY,
    },
  })
  const png = Uint8Array.from(resvg.render().asPng())
  pngCache.set(slug, png)
  return png
}
