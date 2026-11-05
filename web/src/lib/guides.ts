/**
 * Short SEO how-to guides for high-intent UK portal upload limits.
 * Limits and source URLs are copied from api/app/presets.yaml — never invented.
 */

import {
  PORTAL_CATEGORIES,
  categoryForPreset,
  stepsForPreset,
  type PortalCategoryId,
} from "./portal-catalogue"

/** One question/answer pair shown on a guide and in FAQPage JSON-LD. */
export interface GuideFaq {
  q: string
  a: string
}

/** Crawlable how-to page keyed by the matching /fix/<preset> slug. */
export interface Guide {
  slug: string
  presetId: string
  h1: string
  title: string
  description: string
  intro: string
  limit: string
  formats: string
  extras: readonly string[]
  sourceUrl: string
  sourceLabel: string
  verified: boolean
  lastChecked: string
  ctaLabel: string
  faq: readonly GuideFaq[]
}

const LAST_CHECKED = "2026-11-03"

const PRIVACY_FAQ: GuideFaq = {
  q: "Do you keep my file?",
  a: "No. Files are deleted 1 hour after processing. We never log file contents. This tool only fixes format, size and pixels — it does not check faces, backgrounds or content, and it does not guarantee a portal will accept the file.",
}

/** Highest-intent portals with a published or clearly labelled limit. */
const GUIDES: Record<string, Omit<Guide, "slug" | "presetId">> = {
  "uk-passport-online": {
    h1: "How to resize a photo for a UK passport online",
    title: "How to resize a photo for a UK passport online | Chowbea",
    description:
      "GOV.UK digital passport photos must be colour JPEG, at least 600×750, and between 50KB and 10MB. Do not crop — GOV.UK crops for you. Fix a file in the browser.",
    intro:
      "GOV.UK rejects passport photos that are the wrong type, too small in pixels, or outside the 50KB–10MB window. This page quotes that official limit, then sends you to a free fixer that converts HEIC to JPEG without cropping.",
    limit: "50KB–10MB",
    formats: "JPEG (JPG)",
    extras: [
      "Colour",
      "At least 600×750 pixels",
      "Do not crop — the GOV.UK service crops the photo",
    ],
    sourceUrl: "https://www.gov.uk/photos-for-passports",
    sourceLabel: "GOV.UK: Photos for passports",
    verified: true,
    lastChecked: LAST_CHECKED,
    ctaLabel: "Resize my passport photo",
    faq: [
      {
        q: "What is the UK passport photo size limit online?",
        a: "GOV.UK digital photos must be between 50KB and 10MB, colour, and at least 600×750 pixels. JPEG is required. Do not crop the photo yourself.",
      },
      {
        q: "Can I upload an iPhone HEIC photo?",
        a: "Not directly. The fixer converts HEIC to JPEG and keeps GOV.UK's 50KB–10MB and 600×750 rules. We do not crop.",
      },
      PRIVACY_FAQ,
    ],
  },
  "uk-visa-face": {
    h1: "How to resize a UK visa photo (JPEG, 6MB)",
    title: "How to resize a UK visa photo online (50KB–6MB) | Chowbea",
    description:
      "UK visa photos must be colour JPEG, portrait, at least 600×750, and between 50KB and 6MB. Convert a phone photo without cropping.",
    intro:
      "Home Office visa-photo guidance asks for a colour JPEG that is vertically orientated, at least 600×750, and between 50KB and 6MB. If a phone photo is HEIC or too large, convert it before you upload.",
    limit: "50KB–6MB",
    formats: "JPEG (JPG)",
    extras: [
      "Colour",
      "Portrait (vertically orientated)",
      "At least 600×750 pixels",
      "Do not crop — the portal crops the photo",
    ],
    sourceUrl:
      "https://www.gov.uk/guidance/how-to-take-a-photo-for-a-visa-application-or-permission",
    sourceLabel: "GOV.UK: How to take a photo for a visa application",
    verified: true,
    lastChecked: LAST_CHECKED,
    ctaLabel: "Resize my visa photo",
    faq: [
      {
        q: "What size does a UK visa photo need to be?",
        a: "Official guidance: JPG/JPEG, colour, vertically orientated, 50KB–6MB, and at least 600×750 pixels.",
      },
      {
        q: "Will you crop my visa photo?",
        a: "No. We keep the aspect ratio. The visa service crops the photo on their side.",
      },
      PRIVACY_FAQ,
    ],
  },
  ukvcas: {
    h1: "UKVCAS document size limit — how to get under 6MB",
    title: "UKVCAS file too large (6MB limit) — how to compress | Chowbea",
    description:
      "UKVCAS accepts PDF (preferred), JPG or PNG, not password-protected, and no larger than 6MB. Compress a scan before your appointment.",
    intro:
      "UKVCAS asks you to upload documents before an appointment. Their own 'Preparing your documents' page caps each file at 6MB and prefers PDF. Unlock any password first — protected files are rejected.",
    limit: "6MB per file",
    formats: "PDF (preferred), JPG, PNG",
    extras: ["Not password-protected"],
    sourceUrl: "https://www.ukvcas.co.uk/help-support/ourinfo/prepareDocuments",
    sourceLabel: "UKVCAS: Preparing your documents",
    verified: true,
    lastChecked: LAST_CHECKED,
    ctaLabel: "Fix my UKVCAS file",
    faq: [
      {
        q: "What is the UKVCAS upload size limit?",
        a: "UKVCAS says files must be no larger than 6MB. PDF is preferred; JPG or PNG are also accepted. Password-protected files are not.",
      },
      {
        q: "Can I upload a password-protected PDF to UKVCAS?",
        a: "No. Unlock the PDF first, then compress it under 6MB.",
      },
      PRIVACY_FAQ,
    ],
  },
  "eu-settlement": {
    h1: "EU Settlement Scheme file too large (6MB limit)",
    title: "EU Settlement Scheme upload size limit (6MB) | Chowbea",
    description:
      "GOV.UK allows a maximum of 10 residence-evidence documents, each no more than 6MB. Compress photos or scans — do not post originals.",
    intro:
      "The EU Settlement Scheme residence-evidence page caps you at 10 documents, each no more than 6MB. That page does not list file types; PDF, JPG and PNG match the Home Office self-upload formats this tool emits.",
    limit: "6MB per document (max 10 files)",
    formats: "PDF, JPG or PNG (Home Office self-upload types)",
    extras: [
      "Maximum 10 documents on GOV.UK",
      "Photos or scans — do not post originals",
    ],
    sourceUrl:
      "https://www.gov.uk/guidance/eu-settlement-scheme-evidence-of-uk-residence",
    sourceLabel: "GOV.UK: EU Settlement Scheme evidence of UK residence",
    verified: true,
    lastChecked: LAST_CHECKED,
    ctaLabel: "Fix my EU Settlement file",
    faq: [
      {
        q: "What is the EU Settlement Scheme upload limit?",
        a: "GOV.UK: a maximum of 10 documents, each no more than 6MB. Upload photos or scans; do not post originals.",
      },
      {
        q: "Which file types does the EU Settlement Scheme accept?",
        a: "The residence-evidence page does not list formats. This tool emits PDF, JPG or PNG, matching Home Office self-upload types.",
      },
      PRIVACY_FAQ,
    ],
  },
  "student-visa-cas": {
    h1: "Student visa file too large — CAS evidence upload",
    title: "Student visa file too large — compress CAS evidence | Chowbea",
    description:
      "A CAS is a number, not a file. Supporting evidence (finance, TB, guardian) follows Home Office self-upload types. GOV.UK lists no byte cap — 6MB is commonly reported.",
    intro:
      "A Confirmation of Acceptance for Studies (CAS) is a virtual record you type into the form, not a PDF you upload. Finance, TB and guardian documents go through the visa self-upload service. GOV.UK lists required documents but not a byte limit, so 6MB here is a commonly reported target — check the upload screen on your application.",
    limit: "6MB per file (commonly reported — not published on GOV.UK)",
    formats: "PDF, PNG, JPG or JPEG (self-upload types)",
    extras: [
      "The CAS itself is a number, not a file",
      "No official byte limit is published on the Student visa documents page",
    ],
    sourceUrl: "https://www.gov.uk/student-visa/documents-you-must-provide",
    sourceLabel: "GOV.UK: Student visa documents you must provide",
    verified: false,
    lastChecked: LAST_CHECKED,
    ctaLabel: "Fix my Student visa evidence",
    faq: [
      {
        q: "Is there an official Student visa / CAS file size limit?",
        a: "No. GOV.UK lists the documents you must provide but does not publish a per-file byte limit. 6MB is a conservative commonly reported target. Check the upload screen on your application.",
      },
      {
        q: "Do I upload the CAS as a PDF?",
        a: "No. A CAS is a virtual record. Enter the CAS number on the form and upload supporting evidence (finance, TB, guardian consent) separately.",
      },
      PRIVACY_FAQ,
    ],
  },
  "student-finance-england": {
    h1: "Student Finance England file too large (16MB)",
    title: "Student Finance England file too large (16MB limit) | Chowbea",
    description:
      "Student Finance England evidence cannot be larger than 16MB. GOV.UK does not list formats on that page; this tool emits PDF, JPG or PNG.",
    intro:
      "The official Student Finance England how-to guide says an evidence file cannot be larger than 16MB (the same figure is used for household-income evidence). Upload only if they asked, and only once. That page does not list accepted formats.",
    limit: "16MB per file",
    formats:
      "PDF, JPG or PNG (types this tool emits — GOV.UK does not list formats on that page)",
    extras: ["Upload only if Student Finance England asked for the evidence"],
    sourceUrl:
      "https://www.gov.uk/guidance/student-finance-england-how-to-guide",
    sourceLabel: "GOV.UK: Student Finance England how-to guide",
    verified: true,
    lastChecked: LAST_CHECKED,
    ctaLabel: "Fix my Student Finance file",
    faq: [
      {
        q: "What is the Student Finance England upload size limit?",
        a: "The official how-to guide says an evidence file cannot be larger than 16MB. The same 16MB figure is repeated for household-income evidence.",
      },
      {
        q: "Which formats does Student Finance England accept?",
        a: "GOV.UK does not list accepted formats on that page. This tool outputs PDF, JPG or PNG.",
      },
      PRIVACY_FAQ,
    ],
  },
  "hmrc-compliance": {
    h1: "HMRC file too large — compliance check 15MB limit",
    title: "HMRC file too large (15MB compliance check) | Chowbea",
    description:
      "HMRC compliance-check uploads are 15MB or less per file, up to 10 files at a time. PDF, JPEG, Word and ODT are accepted; shrink a scan here.",
    intro:
      "If HMRC asked you to send documents for a compliance check, each file must be 15MB or less and you can send up to 10 files at a time. Official formats include PDF, JPEG, DOCX and ODT (plus spreadsheets and slides this tool does not emit).",
    limit: "15MB per file (up to 10 files)",
    formats: "PDF, JPEG, DOCX, ODT (HMRC also lists XLSX, ODS, PPTX, ODP)",
    extras: [
      "Up to 10 files at a time",
      "Include the case reference on the HMRC form",
    ],
    sourceUrl:
      "https://www.gov.uk/guidance/send-documents-or-information-to-hmrc-for-a-compliance-check",
    sourceLabel: "GOV.UK: Send documents to HMRC for a compliance check",
    verified: true,
    lastChecked: LAST_CHECKED,
    ctaLabel: "Fix my HMRC compliance file",
    faq: [
      {
        q: "What is the HMRC compliance check file size limit?",
        a: "Official GOV.UK guidance: each file 15MB or less, and up to 10 files at a time.",
      },
      {
        q: "What file types does HMRC accept for a compliance check?",
        a: "PDF, JPEG, XLSX, ODS, DOCX, ODT, PPTX or ODP. This fixer converts images and Word to PDF or JPEG rather than emitting spreadsheets or slides.",
      },
      PRIVACY_FAQ,
    ],
  },
  "hmrc-cds": {
    h1: "HMRC CDS file too large (10MB supporting documents)",
    title: "HMRC CDS file too large (10MB limit) | Chowbea",
    description:
      "Customs Declaration Service supporting documents are JPG, PNG, TXT or PDF, up to 10 files, each up to 10MB. Compress a scan before you send it.",
    intro:
      "HMRC's Customs Declaration Service documents form accepts JPG, PNG, TXT or PDF. You can send up to 10 files at a time, each up to 10MB. This tool outputs PDF or an image, not TXT.",
    limit: "10MB per file (up to 10 files)",
    formats: "JPG, PNG or PDF (HMRC also lists TXT)",
    extras: ["Up to 10 files at a time"],
    sourceUrl:
      "https://www.gov.uk/guidance/send-documents-to-support-declarations-for-the-customs-declaration-service",
    sourceLabel: "GOV.UK: Send documents for the Customs Declaration Service",
    verified: true,
    lastChecked: LAST_CHECKED,
    ctaLabel: "Fix my HMRC CDS file",
    faq: [
      {
        q: "What is the HMRC CDS upload size limit?",
        a: "Official GOV.UK CDS guidance: each supporting document up to 10MB, and up to 10 files at a time.",
      },
      {
        q: "What formats does HMRC CDS accept?",
        a: "JPG, PNG, TXT or PDF. This tool outputs PDF or an image rather than TXT.",
      },
      PRIVACY_FAQ,
    ],
  },
  "ucas-documents": {
    h1: "UCAS document size limit — how to compress under 5MB",
    title: "UCAS document size limit (5MB) — how to compress | Chowbea",
    description:
      "UCAS accepts PDF, JPEG/JPG or ODT, 5MB per file, with no password and no HEIC. Shrink a transcript or reference before you upload.",
    intro:
      "The UCAS applicant FAQ caps each document at 5MB and accepts PDF, JPEG/JPG or ODT. Password-protected files and HEIC photos are rejected. Unlock a PDF first if it asks for a password.",
    limit: "5MB per file",
    formats: "PDF, JPEG/JPG or ODT",
    extras: ["No password protection", "No HEIC"],
    sourceUrl:
      "https://www.ucas.com/applying/applying-to-university/uploading-documents-to-your-application",
    sourceLabel: "UCAS: Uploading documents to your application",
    verified: true,
    lastChecked: LAST_CHECKED,
    ctaLabel: "Fix my UCAS document",
    faq: [
      {
        q: "What is the UCAS document size limit?",
        a: "The official UCAS applicant FAQ: PDF, JPEG/JPG or ODT, 5MB per file, no password, no HEIC.",
      },
      {
        q: "Why was my UCAS PDF rejected?",
        a: "Password-protected PDFs are rejected. Unlock the file, keep it under 5MB, and use PDF, JPEG or ODT — not HEIC.",
      },
      PRIVACY_FAQ,
    ],
  },
  "companies-house": {
    h1: "Companies House file too large (4MB PDF)",
    title: "Companies House file too large (4MB PDF limit) | Chowbea",
    description:
      "The Companies House upload service requires a PDF smaller than 4MB, one document at a time. Compress continuation pages into a single PDF.",
    intro:
      "Companies House 'Upload a document' guidance: save as PDF; the file must be less than 4MB; send one document at a time. Merge continuation pages into that one PDF before you upload.",
    limit: "Under 4MB",
    formats: "PDF",
    extras: ["One document at a time", "Merge continuation pages into one PDF"],
    sourceUrl:
      "https://find-and-update.company-information.service.gov.uk/efs-submission/guidance",
    sourceLabel: "Companies House: Upload a document guidance",
    verified: true,
    lastChecked: LAST_CHECKED,
    ctaLabel: "Fix my Companies House PDF",
    faq: [
      {
        q: "What is the Companies House upload size limit?",
        a: "Official guidance: save as PDF; the file must be less than 4MB. One document at a time.",
      },
      {
        q: "Can I upload a Word file to Companies House?",
        a: "The upload service asks for PDF. Convert Word to PDF and keep the result under 4MB.",
      },
      PRIVACY_FAQ,
    ],
  },
  dbs: {
    h1: "DBS upload size limit — how to get a file under 10MB",
    title: "DBS upload size limit (10MB) — how to compress | Chowbea",
    description:
      "DBS's published online upload cap is 10MB per file (up to 35 files), not password-protected. Unlock a PDF before you compress it.",
    intro:
      "Official DBS online barring-referral guidance: upload up to 35 files, each up to 10MB, clear, readable and not password-protected. Employer or umbrella ID-check portals may use a different cap — this page follows DBS's own published 10MB service.",
    limit: "10MB per file (up to 35 files)",
    formats: "PDF, JPEG, PNG or DOCX",
    extras: [
      "Not password-protected",
      "Employer-hosted ID checks may use a different limit",
    ],
    sourceUrl:
      "https://www.gov.uk/government/publications/dbs-guidance-leaflets/dbs-online-barring-referral-service-guidance",
    sourceLabel: "GOV.UK: DBS online barring referral service guidance",
    verified: true,
    lastChecked: LAST_CHECKED,
    ctaLabel: "Fix my DBS file",
    faq: [
      {
        q: "What is the DBS document upload size limit?",
        a: "DBS's published online-upload cap is 10MB per file, up to 35 files, and files must not be password-protected.",
      },
      {
        q: "Does this cover an employer DBS ID check?",
        a: "Not always. Standard identity checks often go through an employer or umbrella body with their own limits. This guide follows DBS's own published 10MB upload service.",
      },
      PRIVACY_FAQ,
    ],
  },
  "land-registry": {
    h1: "Land Registry file too large (40MB plan upload)",
    title: "Land Registry upload size limit (40MB) | Chowbea",
    description:
      "HM Land Registry portal plans must not exceed 40MB and must be GIF, JPEG, PDF or TIFF. Compress a plan before you attach it.",
    intro:
      "Official GOV.UK Land Registry portal guidance for attaching a plan: the file must not exceed 40MB and must be GIF, JPEG, PDF or TIFF. A 2024 GOV.UK news item confirms the portal cap was raised from 20MB to 40MB.",
    limit: "40MB",
    formats: "GIF, JPEG, PDF or TIFF",
    extras: [],
    sourceUrl:
      "https://www.gov.uk/guidance/land-registry-portal-official-search-of-part-with-priority",
    sourceLabel: "GOV.UK: Land Registry portal — official search of part",
    verified: true,
    lastChecked: LAST_CHECKED,
    ctaLabel: "Fix my Land Registry plan",
    faq: [
      {
        q: "What is the HM Land Registry portal file size limit?",
        a: "Official portal guidance: a plan must not exceed 40MB and must be GIF, JPEG, PDF or TIFF.",
      },
      {
        q: "Was the Land Registry limit 20MB?",
        a: "It used to be. A 2024 GOV.UK news item confirms the portal file-size limit was raised from 20MB to 40MB.",
      },
      PRIVACY_FAQ,
    ],
  },
  "hmcts-efiling": {
    h1: "HMCTS e-Filing file too large (50MB per document)",
    title: "HMCTS e-Filing file too large (50MB limit) | Chowbea",
    description:
      "HMCTS e-Filing allows 50MB per document and up to 10 documents per filing. Unlock a password-protected PDF, then compress it.",
    intro:
      "The official GOV.UK HMCTS e-Filing guide sets a 50MB maximum for each document and up to 10 documents per filing. Some courts also ask for a 20MB core bundle for urgent applications — this page follows the e-Filing 50MB figure.",
    limit: "50MB per document (up to 10 per filing)",
    formats: "PDF",
    extras: [
      "Unlock any password first",
      "Some courts also ask for a 20MB core bundle for urgent applications",
    ],
    sourceUrl:
      "https://www.gov.uk/government/publications/how-to-use-the-hmcts-e-filing-service/submit-and-manage-your-filings",
    sourceLabel: "GOV.UK: How to use the HMCTS e-Filing service",
    verified: true,
    lastChecked: LAST_CHECKED,
    ctaLabel: "Fix my HMCTS PDF",
    faq: [
      {
        q: "What is the HMCTS e-Filing file size limit?",
        a: "Official GOV.UK guide: maximum file size for each document is 50MB, and up to 10 documents per filing.",
      },
      {
        q: "Why do some courts mention 20MB?",
        a: "Some courts ask for a 20MB core bundle for urgent applications. That is a different instruction. This fixer follows the e-Filing 50MB-per-document figure.",
      },
      PRIVACY_FAQ,
    ],
  },
  "nhs-jobs": {
    h1: "NHS Jobs file too large (1MB supporting documents)",
    title: "NHS Jobs file too large (1MB supporting documents) | Chowbea",
    description:
      "NHS Jobs supporting documents are DOC, DOCX or PDF, 1MB each (up to 4 files). This is not a CV upload — applicants paste CVs as text.",
    intro:
      "The official NHSBSA FAQ for supporting documents on a job listing: DOC, DOCX or PDF, 1MB each, up to 4 files. NHS Jobs applicants cannot upload a CV file and must paste text. Use this fixer for the supporting-document field only.",
    limit: "1MB per file (up to 4 files)",
    formats: "DOC, DOCX or PDF",
    extras: [
      "Supporting documents on a job listing — not an applicant CV upload",
      "Oversize Word files are converted to PDF",
    ],
    sourceUrl: "https://faq.nhsbsa.nhs.uk/knowledgebase/article/KA-25732/en-us",
    sourceLabel: "NHSBSA FAQ: supporting documents on a job listing",
    verified: true,
    lastChecked: LAST_CHECKED,
    ctaLabel: "Fix my NHS Jobs document",
    faq: [
      {
        q: "What is the NHS Jobs file size limit?",
        a: "Official NHSBSA FAQ: supporting documents on a job listing are DOC, DOCX or PDF, 1MB each, up to 4 files.",
      },
      {
        q: "Can I upload a CV file on NHS Jobs?",
        a: "No. NHS Jobs applicants cannot upload a CV file and must paste text. This 1MB limit is for employer supporting documents on a listing.",
      },
      PRIVACY_FAQ,
    ],
  },
}

/** Preset ids that have a how-to guide, in /portals category order. */
export const GUIDE_IDS = PORTAL_CATEGORIES.flatMap((category) =>
  Object.keys(GUIDES).filter((id) => categoryForPreset(id) === category.id)
)

/** Title, H1 and description for the /guides index. */
export const GUIDES_SEO = {
  h1: "How to fix a file for a UK portal",
  title: "UK portal upload limits — how-to guides | Chowbea",
  description:
    "Short guides for UK passport photos, HMRC, UCAS, Student Finance, NHS Jobs and more. Each page quotes the official limit with a source link, then a free fixer.",
}

/** True when /guides/<slug> should render rather than 404. */
export function isGuideSlug(slug: string): boolean {
  return slug in GUIDES
}

/** Full how-to record for a preset slug, or null if that portal has no guide. */
export function guideFor(slug: string): Guide | null {
  const copy = GUIDES[slug]
  if (!copy) return null
  return { slug, presetId: slug, ...copy }
}

/** Three short fixer steps copied from the matching /fix page. */
export function guideSteps(slug: string): string[] {
  const guide = guideFor(slug)
  return stepsForPreset(slug, guide?.h1)
}

/** Guides in one /portals category, in catalogue order. */
export function guidesInCategory(category: PortalCategoryId): Guide[] {
  return GUIDE_IDS.map(guideFor).filter(
    (guide): guide is Guide =>
      guide !== null && categoryForPreset(guide.presetId) === category
  )
}

/** Categories that currently have at least one guide. */
export function guideCategories(): (typeof PORTAL_CATEGORIES)[number][] {
  return PORTAL_CATEGORIES.filter(
    (category) => guidesInCategory(category.id).length > 0
  )
}
