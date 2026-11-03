import { describe, expect, it } from "vitest"

import { PRESET_IDS } from "./portal-catalogue"
import { isOgSlug, ogCard, ogSvg, wrapOgTitle } from "./og-image"

describe("Open Graph cards", () => {
  it("covers every catalogue preset plus default and portals", () => {
    expect(isOgSlug("default")).toBe(true)
    expect(isOgSlug("portals")).toBe(true)
    expect(isOgSlug("not-a-preset")).toBe(false)
    for (const id of PRESET_IDS) {
      expect(isOgSlug(id)).toBe(true)
      expect(ogCard(id).name.length).toBeGreaterThan(2)
      expect(ogCard(id).limit.length).toBeGreaterThan(1)
    }
  })

  it("shows the portal name and its limit in the SVG", () => {
    const svg = ogSvg("uk-passport-online")
    expect(svg).toContain("UK PASSPORT PHOTO")
    expect(svg).toContain("50KB–10MB")
    expect(svg).toContain("#fff3e2")
    expect(svg).toContain("#F2922B")
    expect(svg).toContain("CHOWBEA IMAGE")
  })

  it("wraps long titles onto two lines", () => {
    expect(wrapOgTitle("STUDENT FINANCE ENGLAND")).toEqual([
      "STUDENT FINANCE",
      "ENGLAND",
    ])
  })

  it("puts the UCAS name and 5MB limit on the card", () => {
    const svg = ogSvg("ucas-documents")
    expect(svg).toContain("UCAS DOCUMENTS")
    expect(svg).toContain("5MB")
    expect(svg).toContain('width="1200"')
    expect(svg).toContain('height="630"')
  })
})
