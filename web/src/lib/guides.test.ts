import { describe, expect, it } from "vitest"

import {
  GUIDE_IDS,
  GUIDES_SEO,
  guideCategories,
  guideFor,
  guideSteps,
  guidesInCategory,
  isGuideSlug,
} from "./guides"
import { PORTAL_CATEGORIES, categoryForPreset } from "./portal-catalogue"
import { sitemapPaths } from "./preset-seo"

/** Source URLs copied from api/app/presets.yaml — guides must not invent them. */
const OFFICIAL_SOURCES: Record<string, string> = {
  "uk-passport-online": "https://www.gov.uk/photos-for-passports",
  "uk-visa-face":
    "https://www.gov.uk/guidance/how-to-take-a-photo-for-a-visa-application-or-permission",
  ukvcas: "https://www.ukvcas.co.uk/help-support/ourinfo/prepareDocuments",
  "eu-settlement":
    "https://www.gov.uk/guidance/eu-settlement-scheme-evidence-of-uk-residence",
  "student-visa-cas":
    "https://www.gov.uk/student-visa/documents-you-must-provide",
  "student-finance-england":
    "https://www.gov.uk/guidance/student-finance-england-how-to-guide",
  "hmrc-compliance":
    "https://www.gov.uk/guidance/send-documents-or-information-to-hmrc-for-a-compliance-check",
  "hmrc-cds":
    "https://www.gov.uk/guidance/send-documents-to-support-declarations-for-the-customs-declaration-service",
  "ucas-documents":
    "https://www.ucas.com/applying/applying-to-university/uploading-documents-to-your-application",
  "companies-house":
    "https://find-and-update.company-information.service.gov.uk/efs-submission/guidance",
  dbs: "https://www.gov.uk/government/publications/dbs-guidance-leaflets/dbs-online-barring-referral-service-guidance",
  "land-registry":
    "https://www.gov.uk/guidance/land-registry-portal-official-search-of-part-with-priority",
  "hmcts-efiling":
    "https://www.gov.uk/government/publications/how-to-use-the-hmcts-e-filing-service/submit-and-manage-your-filings",
  "nhs-jobs": "https://faq.nhsbsa.nhs.uk/knowledgebase/article/KA-25732/en-us",
}

describe("how-to guides", () => {
  it("covers at least 10 high-intent portal presets", () => {
    expect(GUIDE_IDS.length).toBeGreaterThanOrEqual(10)
    expect(GUIDE_IDS.length).toBe(new Set(GUIDE_IDS).size)
    expect(GUIDES_SEO.h1.length).toBeGreaterThan(8)
    expect(GUIDES_SEO.title).toMatch(/Chowbea/)
  })

  it("reuses each preset's official source URL and does not invent limits", () => {
    for (const id of Object.keys(OFFICIAL_SOURCES)) {
      const guide = guideFor(id)
      expect(guide, id).toBeTruthy()
      expect(guide?.sourceUrl).toBe(OFFICIAL_SOURCES[id])
      expect(guide?.limit.length).toBeGreaterThan(2)
      expect(guide?.formats.length).toBeGreaterThan(2)
      expect(guide?.faq.length).toBeGreaterThanOrEqual(2)
      expect(guideSteps(id).length).toBeGreaterThanOrEqual(3)
    }
    const cas = guideFor("student-visa-cas")
    expect(cas?.verified).toBe(false)
    expect(cas?.limit).toMatch(/commonly reported/i)
  })

  it("groups guides in the same categories as /portals", () => {
    const grouped = guideCategories().flatMap((category) =>
      guidesInCategory(category.id).map((guide) => guide.slug)
    )
    expect(grouped).toEqual(GUIDE_IDS)
    for (const id of GUIDE_IDS) {
      expect(categoryForPreset(id)).not.toBe("generic")
      expect(
        PORTAL_CATEGORIES.some(
          (category) => category.id === categoryForPreset(id)
        )
      ).toBe(true)
    }
    expect(isGuideSlug("uk-passport-online")).toBe(true)
    expect(isGuideSlug("jpg-1mb")).toBe(false)
    expect(guideFor("missing")).toBeNull()
  })

  it("adds the index and every guide to the sitemap", () => {
    const paths = sitemapPaths()
    expect(paths).toContain("/guides")
    for (const id of GUIDE_IDS) {
      expect(paths).toContain(`/guides/${id}`)
    }
  })
})
