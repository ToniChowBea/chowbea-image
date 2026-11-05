import { afterEach, describe, expect, it, vi } from "vitest"

import {
  HOME_SEO,
  INDEX_SEO,
  PORTALS_SEO,
  PRESET_IDS,
  fallbackFaq,
  pageSeoHead,
  publicSiteOrigin,
  publicUrl,
  robotsTxt,
  seoForPreset,
  sitemapPaths,
  sitemapXml,
} from "./preset-seo"

describe("preset SEO copy", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("uses search-intent H1s for portal presets", () => {
    expect(seoForPreset("ucas-documents").h1).toBe(
      "Compress PDF for UCAS (5MB limit)"
    )
    expect(seoForPreset("uk-passport-online").h1).toMatch(/passport/i)
    expect(seoForPreset("jpg-1mb").title).toMatch(/1 MB/)
  })

  it("covers every catalogue id in the sitemap", () => {
    const paths = sitemapPaths()
    expect(paths).toContain("/")
    expect(paths).toContain("/fix")
    expect(paths).toContain("/portals")
    expect(paths).toContain("/guides")
    expect(paths).toContain("/privacy")
    for (const id of PRESET_IDS) {
      expect(paths).toContain(`/fix/${id}`)
    }
  })

  it("emits xml and robots with the request origin", () => {
    const xml = sitemapXml("https://example.test")
    expect(xml).toContain("<loc>https://example.test/fix/ucas-documents</loc>")
    expect(xml).toContain("<loc>https://example.test/portals</loc>")
    expect(xml).toContain("<loc>https://example.test/guides</loc>")
    expect(xml).toContain(
      "<loc>https://example.test/guides/uk-passport-online</loc>"
    )
    expect(xml).toContain(
      "<loc>https://example.test/guides/saas-documents</loc>"
    )
    expect(xml).toContain("<loc>https://example.test/guides/linkedin-cv</loc>")
    expect(xml).toContain(
      "<loc>https://example.test/guides/ukvi-evidence</loc>"
    )
    expect(xml).not.toContain(
      "<loc>https://example.test/guides/vfs-global</loc>"
    )
    expect(xml).not.toContain(
      "<loc>https://example.test/guides/rightmove</loc>"
    )
    expect(xml).toContain("<loc>https://example.test/fix/eu-settlement</loc>")
    expect(robotsTxt("https://example.test")).toContain(
      "Sitemap: https://example.test/sitemap.xml"
    )
  })

  it("emits https sitemap and robots URLs, not the inbound http proxy origin", () => {
    vi.stubEnv("VITE_PUBLIC_SITE_URL", "")
    const inbound = new URL("http://img.chowbea.com/sitemap.xml")
    expect(inbound.origin).toBe("http://img.chowbea.com")

    const origin = publicSiteOrigin()
    const xml = sitemapXml(origin)
    const robots = robotsTxt(origin)

    expect(origin).toBe("https://img.chowbea.com")
    expect(xml).toContain("<loc>https://img.chowbea.com/fix</loc>")
    expect(xml).toContain(
      "<loc>https://img.chowbea.com/fix/uk-passport-online</loc>"
    )
    expect(xml).not.toContain("http://img.chowbea.com")
    expect(robots).toBe(
      "User-agent: *\nAllow: /\nSitemap: https://img.chowbea.com/sitemap.xml\n"
    )
  })

  it("upgrades a configured http public origin to https except on localhost", () => {
    vi.stubEnv("VITE_PUBLIC_SITE_URL", "http://img.chowbea.com/")
    expect(publicSiteOrigin()).toBe("https://img.chowbea.com")
    vi.stubEnv("VITE_PUBLIC_SITE_URL", "http://localhost:3000")
    expect(publicSiteOrigin()).toBe("http://localhost:3000")
  })

  it("builds canonical and social tags on the public https origin", () => {
    vi.stubEnv("VITE_PUBLIC_SITE_URL", "")
    const head = pageSeoHead(
      seoForPreset("uk-passport-online").title,
      seoForPreset("uk-passport-online").description,
      "/fix/uk-passport-online",
      "/og/uk-passport-online.png"
    )
    expect(publicUrl("/fix/uk-passport-online")).toBe(
      "https://img.chowbea.com/fix/uk-passport-online"
    )
    expect(head.links).toContainEqual({
      rel: "canonical",
      href: "https://img.chowbea.com/fix/uk-passport-online",
    })
    expect(head.meta).toContainEqual({
      property: "og:url",
      content: "https://img.chowbea.com/fix/uk-passport-online",
    })
    expect(head.meta).toContainEqual({
      name: "twitter:title",
      content: seoForPreset("uk-passport-online").title,
    })
    expect(head.meta).toContainEqual({
      name: "twitter:card",
      content: "summary_large_image",
    })
    expect(head.meta).toContainEqual({
      property: "og:image",
      content: "https://img.chowbea.com/og/uk-passport-online.png",
    })
    expect(HOME_SEO.title).toBe("Chowbea Image")
  })

  it("mentions optional PostHog on the privacy FAQ", () => {
    const privacy = fallbackFaq().find((item) => item.q.includes("keep"))
    expect(privacy?.a).toMatch(/PostHog/)
  })

  it("keeps the /fix index title and H1", () => {
    expect(INDEX_SEO.h1).toMatch(/upload limit/i)
    expect(INDEX_SEO.title).toMatch(/Chowbea/)
    expect(PORTALS_SEO.h1).toMatch(/portal/i)
    expect(PORTALS_SEO.title).toMatch(/Chowbea/)
  })

  it("builds https canonical and OG tags for a new portal page", () => {
    const seo = seoForPreset("student-finance-england")
    const head = pageSeoHead(
      seo.title,
      seo.description,
      "/fix/student-finance-england"
    )
    expect(head.links).toContainEqual({
      rel: "canonical",
      href: "https://img.chowbea.com/fix/student-finance-england",
    })
    expect(head.meta).toContainEqual({
      property: "og:url",
      content: "https://img.chowbea.com/fix/student-finance-england",
    })
    expect(seo.h1).toMatch(/Student Finance England/)
  })
})
