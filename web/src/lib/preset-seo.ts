/**
 * Crawlable titles, H1s and FAQs for /fix pages. Kept in the web bundle so
 * `head()` and the sitemap work without calling the API at request time.
 */

import { PRESET_IDS } from "./portal-catalogue"

export { PRESET_IDS, stepsForPreset } from "./portal-catalogue"
export type { PresetId } from "./portal-catalogue"

/** Production origin used when VITE_PUBLIC_SITE_URL is unset. */
const DEFAULT_PUBLIC_ORIGIN = "https://img.chowbea.com"

/** Canonical public origin for sitemap, robots, canonical, Open Graph, and JSON-LD. */
export function publicSiteOrigin(): string {
  const raw = import.meta.env.VITE_PUBLIC_SITE_URL
  const value = (
    typeof raw === "string" && raw.trim() ? raw.trim() : DEFAULT_PUBLIC_ORIGIN
  ).replace(/\/$/, "")
  try {
    const url = new URL(value)
    const local = url.hostname === "localhost" || url.hostname === "127.0.0.1"
    // Railway/Cloudflare terminate TLS, so inbound URLs are http://. Force https
    // for any public host; leave localhost alone for `bun dev`.
    if (!local && url.protocol === "http:") {
      url.protocol = "https:"
    }
    return url.origin
  } catch {
    return DEFAULT_PUBLIC_ORIGIN
  }
}

/** Absolute URL on the public origin, e.g. `/fix` → `https://img.chowbea.com/fix`. */
export function publicUrl(path: string): string {
  const suffix = path.startsWith("/") ? path : `/${path}`
  return `${publicSiteOrigin()}${suffix}`
}

/**
 * Title, description, canonical, and social tags. `imagePath` is the
 * per-page Open Graph PNG (`/og/{slug}.png`); default is the site card.
 */
export function pageSeoHead(
  title: string,
  description: string,
  path: string,
  imagePath = "/og/default.png"
) {
  const url = publicUrl(path)
  const image = publicUrl(imagePath)
  return {
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:type", content: "website" },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:url", content: url },
      { property: "og:image", content: image },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { property: "og:image:type", content: "image/png" },
      { property: "og:image:alt", content: title },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: title },
      { name: "twitter:description", content: description },
      { name: "twitter:image", content: image },
      { name: "twitter:image:alt", content: title },
      { name: "twitter:url", content: url },
    ],
    links: [{ rel: "canonical", href: url }],
  }
}

export interface FaqItem {
  q: string
  a: string
}

export interface PresetSeo {
  id: string
  h1: string
  title: string
  description: string
}

const PRIVACY_FAQ: FaqItem[] = [
  {
    q: "Do you keep my file?",
    a: "No. Files are deleted 1 hour after processing. We never log file contents, only generic errors. Optional PostHog events (off without a key) record preset and file type only — never names or bytes.",
  },
  {
    q: "Is a single file free?",
    a: "Yes. Fixing one file is free. An evidence pack (several files, optionally merged to one PDF) is a paid one-off when payments are configured.",
  },
]

const COPY: Record<string, Omit<PresetSeo, "id">> = {
  "uk-passport-online": {
    h1: "Resize a UK passport photo for GOV.UK (10MB limit)",
    title: "UK passport photo resizer (GOV.UK 50KB–10MB) | Chowbea",
    description:
      "Convert HEIC to JPEG, meet GOV.UK's 600×750 minimum, and stay between 50KB and 10MB. We do not crop — GOV.UK crops for you. Files deleted after 1 hour.",
  },
  "uk-visa-face": {
    h1: "Resize a UK visa photo to JPEG (6MB limit)",
    title: "UK visa photo to JPEG (50KB–6MB, portrait) | Chowbea",
    description:
      "Turn a phone photo into a colour JPEG for a UK visa application: 50KB–6MB, at least 600×750, portrait. No crop. Files deleted after 1 hour.",
  },
  "ucas-documents": {
    h1: "Compress PDF for UCAS (5MB limit)",
    title: "Compress PDF for UCAS (5MB upload limit) | Chowbea",
    description:
      "Shrink a transcript or reference to UCAS's 5MB limit. Password-protected PDFs are rejected. Single files are free; evidence packs are a one-off payment.",
  },
  "saas-documents": {
    h1: "Compress documents for SAAS (5MB limit)",
    title: "Compress JPG, TIFF or PDF for SAAS (5MB) | Chowbea",
    description:
      "Fit Student Awards Agency Scotland uploads under 5MB. JPG, TIFF or PDF. Files deleted 1 hour after processing.",
  },
  ukvcas: {
    h1: "Compress files for UKVCAS (6MB limit)",
    title: "Compress PDF or photos for UKVCAS (6MB) | Chowbea",
    description:
      "Get a PDF, JPG or PNG under UKVCAS's 6MB upload limit. Files deleted after 1 hour.",
  },
  "vfs-global": {
    h1: "Compress files for VFS Global (2MB limit)",
    title: "Compress PDF or photos for VFS Global (2MB) | Chowbea",
    description:
      "Shrink a PDF, JPG or PNG to VFS Global's 2MB limit. Unverified limit — check the portal. Files deleted after 1 hour.",
  },
  "nhs-jobs": {
    h1: "Compress a document for NHS Jobs (1MB limit)",
    title: "Compress PDF or Word for NHS Jobs (1MB) | Chowbea",
    description:
      "Fit a supporting document under NHS Jobs' 1MB DOC/DOCX/PDF limit. Oversize Word files are converted to PDF. Files deleted after 1 hour.",
  },
  "ukvi-evidence": {
    h1: "Compress files for a UKVI visa application (6MB, commonly reported)",
    title: "UKVI visa upload size limit — compress PDF or photos | Chowbea",
    description:
      "Shrink a PDF, JPG or PNG for UKVI self-upload. GOV.UK lists formats, not a byte cap — 6MB is commonly reported. Files deleted after 1 hour.",
  },
  "eu-settlement": {
    h1: "Compress files for the EU Settlement Scheme (6MB limit)",
    title: "EU Settlement Scheme upload size limit (6MB) | Chowbea",
    description:
      "Fit residence evidence under GOV.UK's 6MB-per-document cap (max 10 files). PDF, JPG or PNG. Files deleted after 1 hour.",
  },
  "student-visa-cas": {
    h1: "Reduce file size for a Student visa / CAS evidence pack",
    title: "Student visa file too large — compress CAS evidence | Chowbea",
    description:
      "Shrink finance, TB or guardian documents for a UK Student visa. CAS is a number, not a file. 6MB is commonly reported. Files deleted after 1 hour.",
  },
  "dvla-photo": {
    h1: "Resize a DVLA driving licence photo (10MB, commonly reported)",
    title: "DVLA photo upload size limit — JPEG resizer | Chowbea",
    description:
      "Turn a phone photo into a JPEG for a DVLA licence photo change. 50KB–10MB and 600×750 are commonly reported, not a DVLA-published figure. Files deleted after 1 hour.",
  },
  "hmrc-compliance": {
    h1: "Compress documents for an HMRC compliance check (15MB limit)",
    title: "HMRC compliance check upload size limit (15MB) | Chowbea",
    description:
      "Fit PDF, JPEG, Word or ODT under HMRC's 15MB-per-file compliance-check cap. Up to 10 files at a time. Files deleted after 1 hour.",
  },
  "hmrc-cds": {
    h1: "Compress files for HMRC Customs Declaration Service (10MB limit)",
    title: "HMRC CDS upload size limit (10MB) | Chowbea",
    description:
      "Shrink a PDF, JPG or PNG to HMRC's 10MB CDS supporting-document limit. Up to 10 files at a time. Files deleted after 1 hour.",
  },
  "student-finance-england": {
    h1: "Compress evidence for Student Finance England (16MB limit)",
    title: "Student Finance England file too large (16MB) | Chowbea",
    description:
      "Fit identity or household-income evidence under SFE's 16MB upload limit. PDF, JPG or PNG. Files deleted after 1 hour.",
  },
  "trac-jobs": {
    h1: "Compress a document for Trac jobs (2MB, commonly reported)",
    title: "Trac jobs upload size limit — compress PDF or Word | Chowbea",
    description:
      "Shrink a supporting document for a Trac vacancy. No official nationwide cap — 2MB is commonly reported. Files deleted after 1 hour.",
  },
  "civil-service-jobs": {
    h1: "Compress a CV for Civil Service Jobs (5MB, commonly reported)",
    title: "Civil Service Jobs file too large — compress CV | Chowbea",
    description:
      "Fit a CV or personal statement for Civil Service Jobs. GOV.UK lists no byte cap — 5MB is commonly reported. Files deleted after 1 hour.",
  },
  "universal-credit": {
    h1: "Compress files for Universal Credit (10MB, commonly reported)",
    title: "Universal Credit upload size limit — compress PDF | Chowbea",
    description:
      "Shrink bank statements or evidence for a Universal Credit to-do. DWP prefers PDF statements. 10MB is commonly reported. Files deleted after 1 hour.",
  },
  "council-housing-benefits": {
    h1: "Reduce file size for council housing and benefits uploads",
    title: "Council housing file too large — compress evidence | Chowbea",
    description:
      "Fit proof for a housing register or council tax reduction claim. Councils vary; 5MB is a conservative commonly reported default. Files deleted after 1 hour.",
  },
  "land-registry": {
    h1: "Compress plans for the HM Land Registry portal (40MB limit)",
    title: "Land Registry upload size limit (40MB) | Chowbea",
    description:
      "Fit a GIF, JPEG, PDF or TIFF plan under HM Land Registry's 40MB portal cap. Files deleted after 1 hour.",
  },
  "companies-house": {
    h1: "Compress a PDF for Companies House (4MB limit)",
    title: "Companies House file too large (4MB PDF) | Chowbea",
    description:
      "Shrink a Companies House upload-service PDF to under 4MB. One document at a time. Files deleted after 1 hour.",
  },
  ofsted: {
    h1: "Compress files for the Ofsted provider portal (5MB, commonly reported)",
    title: "Ofsted portal upload size limit — compress PDF | Chowbea",
    description:
      "Shrink pre-inspection documents for Ofsted's provider portal. No official byte cap — 5MB is commonly reported. Files deleted after 1 hour.",
  },
  sra: {
    h1: "Compress documents for SRA mySRA (5MB, commonly reported)",
    title: "SRA mySRA file too large — compress PDF | Chowbea",
    description:
      "Fit a name-change certificate or supporting PDF for mySRA. No official byte cap — 5MB is commonly reported. Files deleted after 1 hour.",
  },
  gmc: {
    h1: "Compress evidence for GMC registration (5MB, commonly reported)",
    title: "GMC registration file too large — compress PDF | Chowbea",
    description:
      "Shrink PDF evidence for a GMC Online application. No applicant byte cap is published — 5MB is commonly reported. Files deleted after 1 hour.",
  },
  nmc: {
    h1: "Compress documents for NMC registration (2MB, commonly reported)",
    title: "NMC registration upload size limit — compress PDF | Chowbea",
    description:
      "Fit identity or qualification scans for an NMC online account. No official byte cap — 2MB is commonly reported. Files deleted after 1 hour.",
  },
  dbs: {
    h1: "Compress files for a DBS document upload (10MB limit)",
    title: "DBS upload size limit (10MB) | Chowbea",
    description:
      "Fit evidence under DBS's published 10MB-per-file online upload cap. Unlock password-protected PDFs first. Files deleted after 1 hour.",
  },
  "indeed-cv": {
    h1: "Compress a CV for Indeed (2MB, commonly reported)",
    title: "Indeed CV file too large — compress PDF | Chowbea",
    description:
      "Shrink a CV for Indeed. Help pages list no megabyte cap — 2MB is commonly reported. Indeed converts uploads to PDF. Files deleted after 1 hour.",
  },
  "linkedin-cv": {
    h1: "Compress a CV for LinkedIn (2MB recommended)",
    title: "LinkedIn resume upload size limit (2MB) | Chowbea",
    description:
      "Fit a Word or PDF resume under LinkedIn's published 2MB recommendation for Easy Apply. Files deleted after 1 hour.",
  },
  rightmove: {
    h1: "Reduce file size for Rightmove document uploads",
    title: "Rightmove file too large — compress PDF or photos | Chowbea",
    description:
      "Shrink ID or proof-of-address scans for Rightmove. No official tenant-document cap — 5MB is commonly reported. Files deleted after 1 hour.",
  },
  openrent: {
    h1: "Compress ID for OpenRent referencing (5MB, commonly reported)",
    title: "OpenRent referencing file too large — compress ID | Chowbea",
    description:
      "Fit a passport or driving-licence scan for OpenRent referencing. No official byte cap — 5MB is commonly reported. Files deleted after 1 hour.",
  },
  "hmcts-efiling": {
    h1: "Compress a PDF for HMCTS e-Filing (50MB limit)",
    title: "HMCTS e-Filing upload size limit (50MB) | Chowbea",
    description:
      "Fit a court PDF under the official 50MB-per-document e-Filing cap (up to 10 files). Files deleted after 1 hour.",
  },
  "pip-evidence": {
    h1: "Compress PIP supporting evidence (10MB, commonly reported)",
    title: "PIP evidence file too large — compress PDF | Chowbea",
    description:
      "Shrink medical letters or a diary for a PIP claim. GOV.UK lists no byte cap — 10MB is commonly reported. Files deleted after 1 hour.",
  },
  "jpg-100kb": {
    h1: "Compress a JPG to under 100 KB",
    title: "Compress JPG to 100 KB | Chowbea Image",
    description:
      "Shrink a JPEG to under 100 KB for tight portal limits. No account. Files deleted after 1 hour.",
  },
  "jpg-200kb": {
    h1: "Compress a JPG to under 200 KB",
    title: "Compress JPG to 200 KB | Chowbea Image",
    description:
      "Shrink a JPEG to under 200 KB. No account. Files deleted after 1 hour.",
  },
  "jpg-500kb": {
    h1: "Compress a JPG to under 500 KB",
    title: "Compress JPG to 500 KB | Chowbea Image",
    description:
      "Shrink a JPEG to under 500 KB. No account. Files deleted after 1 hour.",
  },
  "jpg-1mb": {
    h1: "Compress a JPG to under 1 MB",
    title: "Compress JPG to 1 MB | Chowbea Image",
    description:
      "Shrink a JPEG to under 1 MB for portal uploads. No account. Files deleted after 1 hour.",
  },
  "jpg-2mb": {
    h1: "Compress a JPG to under 2 MB",
    title: "Compress JPG to 2 MB | Chowbea Image",
    description:
      "Shrink a JPEG to under 2 MB. No account. Files deleted after 1 hour.",
  },
  "pdf-100kb": {
    h1: "Compress a PDF to under 100 KB",
    title: "Compress PDF to 100 KB | Chowbea Image",
    description:
      "Distill a PDF to under 100 KB with Ghostscript. Password-protected files are rejected. Files deleted after 1 hour.",
  },
  "pdf-200kb": {
    h1: "Compress a PDF to under 200 KB",
    title: "Compress PDF to 200 KB | Chowbea Image",
    description: "Distill a PDF to under 200 KB. Files deleted after 1 hour.",
  },
  "pdf-500kb": {
    h1: "Compress a PDF to under 500 KB",
    title: "Compress PDF to 500 KB | Chowbea Image",
    description: "Distill a PDF to under 500 KB. Files deleted after 1 hour.",
  },
  "pdf-1mb": {
    h1: "Compress a PDF to under 1 MB",
    title: "Compress PDF to 1 MB | Chowbea Image",
    description:
      "Distill a PDF to under 1 MB for portal uploads. Files deleted after 1 hour.",
  },
  "pdf-2mb": {
    h1: "Compress a PDF to under 2 MB",
    title: "Compress PDF to 2 MB | Chowbea Image",
    description: "Distill a PDF to under 2 MB. Files deleted after 1 hour.",
  },
}

/** Title and description for the image-toolkit landing page. */
export const HOME_SEO = {
  title: "Chowbea Image",
  description:
    "Bold, free image tools. Convert, compress, resize, rotate, crop, or fix a file to a UK portal's upload rules — no accounts, files deleted 1 hour after processing.",
}

export const INDEX_SEO = {
  h1: "Fix a file to a UK portal's upload limit",
  title: "Compress PDF and photos for UK portal upload limits | Chowbea",
  description:
    "Pick UCAS, GOV.UK passport, HMRC, Student Finance, NHS Jobs or a size target. Convert, resize and compress one file for free. Files deleted after 1 hour.",
}

export const PORTALS_SEO = {
  h1: "UK portal upload limits",
  title: "UK portal upload size limits — compress a file to fit | Chowbea",
  description:
    "Fix a PDF or photo for UKVI, HMRC, DVLA, UCAS, Student Finance, NHS Jobs, Land Registry, Companies House and more. One file is free. Files deleted after 1 hour.",
}

export const PRIVACY_SEO = {
  h1: "Privacy",
  title: "Privacy — files deleted after 1 hour | Chowbea Image",
  description:
    "Chowbea Image does not keep accounts for the fixer. Files are deleted 1 hour after processing. We never log file contents.",
}

/** Title/H1/description for a preset page, with a safe fallback. */
export function seoForPreset(id: string, name?: string): PresetSeo {
  const copy = COPY[id]
  if (copy) return { id, ...copy }
  const h1 = name ? `Fix a file for ${name}` : "Upload fixer"
  return {
    id,
    h1,
    title: `${h1} | Chowbea Image`,
    description:
      "Convert, resize and compress a file to a portal's upload rules. No account. Files deleted 1 hour after processing.",
  }
}

/** Short FAQ used in JSON-LD when the API payload is not yet loaded. */
export function fallbackFaq(name = "this portal"): FaqItem[] {
  return [
    {
      q: `What does ${name} accept?`,
      a: "This tool only fixes format, size and pixels — it does not check faces, backgrounds or content, and it does not guarantee a portal will accept the file.",
    },
    ...PRIVACY_FAQ,
  ]
}

/** Absolute URLs for every public fixer page. */
export function sitemapPaths(): string[] {
  return [
    "/",
    "/fix",
    "/portals",
    "/privacy",
    ...PRESET_IDS.map((id) => `/fix/${id}`),
  ]
}

/** XML sitemap body for the given origin. */
export function sitemapXml(origin: string): string {
  const base = origin.replace(/\/$/, "")
  const urls = sitemapPaths()
    .map(
      (path) => `  <url>
    <loc>${base}${path}</loc>
    <changefreq>weekly</changefreq>
  </url>`
    )
    .join("\n")
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`
}

/** robots.txt that points crawlers at the sitemap. */
export function robotsTxt(origin: string): string {
  const base = origin.replace(/\/$/, "")
  return `User-agent: *\nAllow: /\nSitemap: ${base}/sitemap.xml\n`
}

/** FAQPage JSON-LD for a preset (or the /fix index). */
export function faqJsonLd(faq: FaqItem[]): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  }
}

/** WebApplication + SoftwareApplication JSON-LD describing the free fixer. */
export function appJsonLd(
  origin: string,
  name: string,
  description: string
): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": ["WebApplication", "SoftwareApplication"],
    name,
    applicationCategory: "MultimediaApplication",
    operatingSystem: "Web",
    offers: { "@type": "Offer", price: "0", priceCurrency: "GBP" },
    description,
    url: origin,
  }
}
