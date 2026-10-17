/**
 * Crawlable titles, H1s and FAQs for /fix pages. Kept in the web bundle so
 * `head()` and the sitemap work without calling the API at request time.
 */

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

/** Title, description, self-referencing canonical, and basic social tags. */
export function pageSeoHead(title: string, description: string, path: string) {
  const url = publicUrl(path)
  return {
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:type", content: "website" },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:url", content: url },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: title },
      { name: "twitter:description", content: description },
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

/** Catalogue ids in the order they appear on /fix. */
export const PRESET_IDS = [
  "uk-passport-online",
  "uk-visa-face",
  "ucas-documents",
  "saas-documents",
  "ukvcas",
  "vfs-global",
  "nhs-jobs",
  "jpg-100kb",
  "jpg-200kb",
  "jpg-500kb",
  "jpg-1mb",
  "jpg-2mb",
  "pdf-100kb",
  "pdf-200kb",
  "pdf-500kb",
  "pdf-1mb",
  "pdf-2mb",
] as const

export type PresetId = (typeof PRESET_IDS)[number]

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
    "Pick UCAS, GOV.UK passport, SAAS, NHS Jobs or a size target. Convert, resize and compress one file for free. Evidence packs are a one-off payment. Files deleted after 1 hour.",
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
  return ["/fix", "/privacy", ...PRESET_IDS.map((id) => `/fix/${id}`)]
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

/** SoftwareApplication JSON-LD describing the free fixer. */
export function appJsonLd(
  origin: string,
  name: string,
  description: string
): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name,
    applicationCategory: "MultimediaApplication",
    offers: { "@type": "Offer", price: "0", priceCurrency: "GBP" },
    description,
    url: origin,
  }
}
