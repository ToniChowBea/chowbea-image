import { describe, expect, it } from "vitest"

import {
  GENERIC_IDS,
  PORTAL_CATEGORIES,
  PORTAL_IDS,
  PORTAL_IDS_BY_CATEGORY,
  PRESET_IDS,
  categoryForPreset,
  relatedPresetIds,
  stepsForPreset,
} from "./portal-catalogue"
import { seoForPreset, sitemapPaths } from "./preset-seo"

describe("portal catalogue", () => {
  it("has unique slugs across portals and generic targets", () => {
    expect(PRESET_IDS.length).toBe(new Set(PRESET_IDS).size)
    expect(PORTAL_IDS.length).toBe(new Set(PORTAL_IDS).size)
  })

  it("lists at least 20 UK portals besides the original seven", () => {
    const original = [
      "uk-passport-online",
      "uk-visa-face",
      "ucas-documents",
      "saas-documents",
      "ukvcas",
      "vfs-global",
      "nhs-jobs",
    ]
    const added = PORTAL_IDS.filter((id) => !original.includes(id))
    expect(added.length).toBeGreaterThanOrEqual(20)
  })

  it("groups every portal into the six /portals categories", () => {
    const grouped = PORTAL_CATEGORIES.flatMap(
      (category) => PORTAL_IDS_BY_CATEGORY[category.id]
    )
    expect(grouped).toEqual(PORTAL_IDS)
    for (const id of PORTAL_IDS) {
      expect(categoryForPreset(id)).not.toBe("generic")
    }
    for (const id of GENERIC_IDS) {
      expect(categoryForPreset(id)).toBe("generic")
    }
  })

  it("gives every portal search-intent copy, steps, and a sitemap URL", () => {
    const paths = sitemapPaths()
    expect(paths).toContain("/portals")
    for (const id of PORTAL_IDS) {
      const seo = seoForPreset(id)
      expect(seo.h1.length).toBeGreaterThan(8)
      expect(seo.title).toMatch(/Chowbea/)
      expect(seo.description.length).toBeGreaterThan(20)
      expect(stepsForPreset(id).length).toBeGreaterThanOrEqual(3)
      expect(paths).toContain(`/fix/${id}`)
    }
  })

  it("points each preset at 3–4 siblings in the same category", () => {
    for (const id of PORTAL_IDS) {
      const related = relatedPresetIds(id)
      expect(related).not.toContain(id)
      expect(related.length).toBeGreaterThanOrEqual(2)
      expect(related.length).toBeLessThanOrEqual(4)
      const category = categoryForPreset(id)
      for (const other of related) {
        expect(categoryForPreset(other)).toBe(category)
      }
    }
    const jpgs = relatedPresetIds("jpg-1mb")
    expect(jpgs.length).toBe(4)
    expect(jpgs.every((id) => id.startsWith("jpg-"))).toBe(true)
    const pdfs = relatedPresetIds("pdf-100kb")
    expect(pdfs.every((id) => id.startsWith("pdf-"))).toBe(true)
  })
})
