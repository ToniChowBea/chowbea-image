import { readFile } from "node:fs/promises"
import { join } from "node:path"

import { createFileRoute } from "@tanstack/react-router"

import { isOgSlug } from "@/lib/og-copy"

const PNG_HEADERS = {
  "Content-Type": "image/png",
  "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
}

/** `/og/ucas-documents.png` and `/og/ucas-documents` both map to one card. */
function slugFromParam(raw: string): string {
  return raw.endsWith(".png") ? raw.slice(0, -4) : raw
}

/**
 * Serve the PNG written at build time. Production is Alpine and has no
 * native resvg, so a missing file is a 404 rather than an on-the-fly render.
 */
async function ogPng(slug: string): Promise<Uint8Array | null> {
  const candidates = [
    join(process.cwd(), "public", "og", `${slug}.png`),
    join(process.cwd(), ".output", "public", "og", `${slug}.png`),
  ]
  for (const file of candidates) {
    try {
      return await readFile(file)
    } catch {
      continue
    }
  }
  return null
}

/** Cached 1200×630 Open Graph PNG for a preset, /portals, or the default card. */
export const Route = createFileRoute("/og/$slug")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const slug = slugFromParam(params.slug)
        if (!isOgSlug(slug)) {
          return new Response("Not found", { status: 404 })
        }
        const png = await ogPng(slug)
        if (!png) {
          return new Response("Not found", { status: 404 })
        }
        const bytes = new Uint8Array(png.byteLength)
        bytes.set(png)
        return new Response(bytes.buffer, { headers: PNG_HEADERS })
      },
    },
  },
})
