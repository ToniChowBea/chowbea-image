import { describe, expect, it } from "vitest"

import {
  INDEX_SEO,
  PRESET_IDS,
  fallbackFaq,
  robotsTxt,
  seoForPreset,
  sitemapPaths,
  sitemapXml,
} from "./preset-seo"

describe("preset SEO copy", () => {
  it("uses search-intent H1s for portal presets", () => {
    expect(seoForPreset("ucas-documents").h1).toBe("Compress PDF for UCAS (5MB limit)")
    expect(seoForPreset("uk-passport-online").h1).toMatch(/passport/i)
    expect(seoForPreset("jpg-1mb").title).toMatch(/1 MB/)
  })

  it("covers every catalogue id in the sitemap", () => {
    const paths = sitemapPaths()
    expect(paths).toContain("/fix")
    expect(paths).toContain("/privacy")
    for (const id of PRESET_IDS) {
      expect(paths).toContain(`/fix/${id}`)
    }
  })

  it("emits xml and robots with the request origin", () => {
    const xml = sitemapXml("https://example.test")
    expect(xml).toContain("<loc>https://example.test/fix/ucas-documents</loc>")
    expect(robotsTxt("https://example.test")).toContain(
      "Sitemap: https://example.test/sitemap.xml"
    )
  })

  it("mentions optional PostHog on the privacy FAQ", () => {
    const privacy = fallbackFaq().find((item) => item.q.includes("keep"))
    expect(privacy?.a).toMatch(/PostHog/)
  })

  it("keeps the /fix index title and H1", () => {
    expect(INDEX_SEO.h1).toMatch(/upload limit/i)
    expect(INDEX_SEO.title).toMatch(/Chowbea/)
  })
})
