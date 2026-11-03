/**
 * Short names and limits drawn on Open Graph cards. Kept separate from the
 * long search-intent H1s so a 1200×630 image stays readable.
 */

import { PORTAL_IDS, PRESET_IDS } from "./portal-catalogue"

export interface OgCard {
  name: string
  limit: string
}

const PRESET_CARDS: Record<string, OgCard> = {
  "uk-passport-online": { name: "UK passport photo", limit: "50KB–10MB" },
  "uk-visa-face": { name: "UK visa photo", limit: "50KB–6MB" },
  "ucas-documents": { name: "UCAS documents", limit: "5MB" },
  "saas-documents": { name: "SAAS documents", limit: "5MB" },
  ukvcas: { name: "UKVCAS", limit: "6MB" },
  "vfs-global": { name: "VFS Global", limit: "2MB" },
  "nhs-jobs": { name: "NHS Jobs", limit: "1MB" },
  "ukvi-evidence": { name: "UKVI visa evidence", limit: "6MB" },
  "eu-settlement": { name: "EU Settlement Scheme", limit: "6MB" },
  "student-visa-cas": { name: "Student visa evidence", limit: "6MB" },
  "dvla-photo": { name: "DVLA licence photo", limit: "50KB–10MB" },
  "hmrc-compliance": { name: "HMRC compliance check", limit: "15MB" },
  "hmrc-cds": { name: "HMRC CDS", limit: "10MB" },
  "student-finance-england": { name: "Student Finance England", limit: "16MB" },
  "trac-jobs": { name: "Trac jobs", limit: "2MB" },
  "civil-service-jobs": { name: "Civil Service Jobs", limit: "5MB" },
  "universal-credit": { name: "Universal Credit", limit: "10MB" },
  "council-housing-benefits": { name: "Council housing", limit: "5MB" },
  "land-registry": { name: "HM Land Registry", limit: "40MB" },
  "companies-house": { name: "Companies House", limit: "4MB" },
  ofsted: { name: "Ofsted portal", limit: "5MB" },
  sra: { name: "SRA mySRA", limit: "5MB" },
  gmc: { name: "GMC registration", limit: "5MB" },
  nmc: { name: "NMC registration", limit: "2MB" },
  dbs: { name: "DBS upload", limit: "10MB" },
  "indeed-cv": { name: "Indeed CV", limit: "2MB" },
  "linkedin-cv": { name: "LinkedIn CV", limit: "2MB" },
  rightmove: { name: "Rightmove documents", limit: "5MB" },
  openrent: { name: "OpenRent ID", limit: "5MB" },
  "hmcts-efiling": { name: "HMCTS e-Filing", limit: "50MB" },
  "pip-evidence": { name: "PIP evidence", limit: "10MB" },
  "jpg-100kb": { name: "Compress JPG", limit: "100 KB" },
  "jpg-200kb": { name: "Compress JPG", limit: "200 KB" },
  "jpg-500kb": { name: "Compress JPG", limit: "500 KB" },
  "jpg-1mb": { name: "Compress JPG", limit: "1 MB" },
  "jpg-2mb": { name: "Compress JPG", limit: "2 MB" },
  "pdf-100kb": { name: "Compress PDF", limit: "100 KB" },
  "pdf-200kb": { name: "Compress PDF", limit: "200 KB" },
  "pdf-500kb": { name: "Compress PDF", limit: "500 KB" },
  "pdf-1mb": { name: "Compress PDF", limit: "1 MB" },
  "pdf-2mb": { name: "Compress PDF", limit: "2 MB" },
}

const SPECIAL_CARDS: Record<string, OgCard> = {
  default: { name: "Chowbea Image", limit: "UK upload-limit fixer" },
  portals: {
    name: "UK portal upload limits",
    limit: `${PORTAL_IDS.length} portals`,
  },
}

/** Slugs that have a dedicated Open Graph PNG. */
export const OG_SLUGS = ["default", "portals", ...PRESET_IDS] as const

export type OgSlug = (typeof OG_SLUGS)[number]

/** True when `/og/{slug}.png` should render rather than 404. */
export function isOgSlug(slug: string): boolean {
  return slug in SPECIAL_CARDS || slug in PRESET_CARDS
}

/** Portal name and limit shown on the Open Graph card for this slug. */
export function ogCard(slug: string): OgCard {
  return (
    SPECIAL_CARDS[slug] ??
    PRESET_CARDS[slug] ?? { name: "Chowbea Image", limit: "Fix a file to fit" }
  )
}
