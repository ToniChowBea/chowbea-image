import { createHash } from "node:crypto"

import { describe, expect, it } from "vitest"

import { OG_SLUGS } from "./og-copy"
import { renderOgPng } from "./og-render"

function sha(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex")
}

describe("Open Graph PNG rasteriser", () => {
  it("paints distinct text for two portal cards", async () => {
    const passport = await renderOgPng("uk-passport-online")
    const ucas = await renderOgPng("ucas-documents")
    expect(passport[0]).toBe(0x89)
    expect(passport[1]).toBe(0x50)
    expect(ucas[0]).toBe(0x89)
    expect(sha(passport)).not.toBe(sha(ucas))
    // Blank cards were ~15KB; text-filled ExtraBold cards are larger.
    expect(passport.byteLength).toBeGreaterThan(20_000)
    expect(ucas.byteLength).toBeGreaterThan(20_000)
  })

  it("covers every OG slug with a unique PNG", async () => {
    const hashes = new Set<string>()
    for (const slug of OG_SLUGS) {
      const png = await renderOgPng(slug)
      hashes.add(sha(png))
    }
    expect(hashes.size).toBe(OG_SLUGS.length)
  })
})
