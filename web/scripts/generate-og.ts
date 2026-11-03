/**
 * Write a 1200×630 PNG for every OG slug into public/og/.
 * Production serves these as static files (no wasm in the Alpine image).
 */

import { mkdir, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

import { OG_SLUGS } from "../src/lib/og-copy"
import { renderOgPng } from "../src/lib/og-render"

const outDir = join(dirname(fileURLToPath(import.meta.url)), "../public/og")
await mkdir(outDir, { recursive: true })

for (const slug of OG_SLUGS) {
  const png = await renderOgPng(slug)
  if (png[0] !== 0x89 || png[1] !== 0x50 || png[2] !== 0x4e || png[3] !== 0x47) {
    throw new Error(`og/${slug}.png is not a PNG`)
  }
  await writeFile(join(outDir, `${slug}.png`), png)
  console.log(`og/${slug}.png ${png.byteLength}B`)
}
