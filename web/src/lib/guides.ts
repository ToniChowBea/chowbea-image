/**
 * Short SEO how-to guides for UK portal upload limits.
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

/**
 * Portal presets with no verified source/limit on a public guidance page.
 * Generic JPG/PDF targets are not portals and also have no source URL.
 */
export const SKIPPED_GUIDE_IDS = ["vfs-global", "rightmove"] as const

/** Portal how-to pages: official limits, or clearly labelled commonly-reported ones. */
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
  "ukvi-evidence": {
    h1: "UKVI visa file too large — evidence upload",
    title: "UKVI visa file too large — compress evidence | Chowbea",
    description:
      "GOV.UK self-upload accepts PDF, PNG, JPG or JPEG. It does not publish a per-file byte cap — 6MB is a conservative commonly reported target. Check the upload screen.",
    intro:
      "GOV.UK's visa self-upload guidance lists PDF, PNG, JPG or JPEG and describes how to scan, but it does not publish a per-file byte limit. 6MB here is a conservative commonly reported target, matching UKVCAS and EU Settlement Scheme figures on official pages. Check the upload screen on your application.",
    limit: "6MB per file (commonly reported — not published on GOV.UK)",
    formats: "PDF, PNG, JPG or JPEG",
    extras: [
      "No official per-file byte limit is published on the self-upload page",
      "Check the upload screen on your application",
    ],
    sourceUrl:
      "https://www.gov.uk/guidance/uploading-evidence-as-part-of-your-visa-application",
    sourceLabel: "GOV.UK: Uploading evidence as part of your visa application",
    verified: false,
    lastChecked: LAST_CHECKED,
    ctaLabel: "Fix my UKVI evidence",
    faq: [
      {
        q: "Is there an official UKVI evidence file size limit?",
        a: "No. GOV.UK lists PDF, PNG, JPG or JPEG and how to scan, but does not publish a per-file byte limit. 6MB is a conservative commonly reported target. Check the upload screen on your application.",
      },
      {
        q: "What file types does UKVI self-upload accept?",
        a: "GOV.UK self-upload guidance: PDF, PNG, JPG or JPEG.",
      },
      PRIVACY_FAQ,
    ],
  },
  "dvla-photo": {
    h1: "How to resize a DVLA driving licence photo",
    title: "How to resize a DVLA driving licence photo | Chowbea",
    description:
      "GOV.UK lets you upload a new driving-licence photo but does not publish a byte or pixel limit. 50KB–10MB and 600×750 are commonly reported from passport digital-photo rules — not a DVLA figure.",
    intro:
      "GOV.UK says you can upload a new photo when changing a driving-licence photo, but that page does not publish a byte or pixel limit. 50KB–10MB and 600×750 here are the GOV.UK digital-photo rules used for passports, commonly reported for DVLA online uploads. Not an official DVLA figure — check the application screen.",
    limit: "50KB–10MB (commonly reported — not a DVLA-published figure)",
    formats: "JPEG (JPG)",
    extras: [
      "Colour",
      "At least 600×750 pixels (commonly reported from GOV.UK digital-photo rules)",
      "Do not crop — this tool does not crop",
    ],
    sourceUrl: "https://www.gov.uk/renew-photo-driving-licence",
    sourceLabel: "GOV.UK: Renew your photo driving licence",
    verified: false,
    lastChecked: LAST_CHECKED,
    ctaLabel: "Resize my DVLA photo",
    faq: [
      {
        q: "What is the DVLA photo upload size limit?",
        a: "GOV.UK does not publish a byte or pixel limit on the driving-licence photo page. 50KB–10MB and 600×750 are commonly reported from GOV.UK digital-photo rules used for passports. Check the application screen.",
      },
      {
        q: "Will you crop my driving licence photo?",
        a: "No. We convert HEIC to JPEG and keep the photo uncropped.",
      },
      PRIVACY_FAQ,
    ],
  },
  "saas-documents": {
    h1: "SAAS document size limit — how to get under 5MB",
    title: "SAAS document size limit (5MB) — how to compress | Chowbea",
    description:
      "SAAS Document Upload Service accepts JPG/JPEG, TIFF/TIF or PDF, 5MB per file, and up to 5 files per transaction. Unlock a password-protected PDF first.",
    intro:
      "The official SAAS Document Upload Service guide accepts JPG/JPEG, TIFF/TIF or PDF, 5MB per file, and a maximum of 5 files per transaction. Unlock any password first — protected files are rejected.",
    limit: "5MB per file (max 5 files per transaction)",
    formats: "JPG/JPEG, TIFF/TIF or PDF",
    extras: ["Not password-protected", "Maximum 5 files per transaction"],
    sourceUrl: "https://www.edocs.saas.gov.uk/help/document_upload_guide.pdf",
    sourceLabel: "SAAS: Document Upload Service guide",
    verified: true,
    lastChecked: LAST_CHECKED,
    ctaLabel: "Fix my SAAS document",
    faq: [
      {
        q: "What is the SAAS document upload size limit?",
        a: "The official SAAS Document Upload Service guide: JPG/JPEG, TIFF/TIF or PDF, 5MB per file, and a maximum of 5 files per transaction.",
      },
      {
        q: "Can I upload a password-protected PDF to SAAS?",
        a: "No. Unlock the PDF first, then keep it under 5MB.",
      },
      PRIVACY_FAQ,
    ],
  },
  "trac-jobs": {
    h1: "Trac jobs file too large — compress a supporting document",
    title: "Trac jobs file too large — compress PDF or Word | Chowbea",
    description:
      "NHSBSA confirms Trac does not accept zip files. No official nationwide byte cap is published — 2MB is a conservative commonly reported target for vacancies that show an upload field.",
    intro:
      "Most Trac vacancies ask you to paste a supporting statement rather than attach a CV. NHSBSA confirms Trac does not accept zip files. No official nationwide byte limit is published, so 2MB here is a conservative commonly reported target for vacancies that do show an upload field — check that vacancy.",
    limit: "2MB per file (commonly reported — no official nationwide cap)",
    formats: "PDF, DOC or DOCX",
    extras: [
      "Trac does not accept zip files",
      "Many vacancies have no upload field — paste a supporting statement instead",
    ],
    sourceUrl:
      "https://faq-hrss.nhsbsa.nhs.uk/knowledgebase/article/KA-23577/en-us",
    sourceLabel: "NHSBSA FAQ: Trac supporting documents",
    verified: false,
    lastChecked: LAST_CHECKED,
    ctaLabel: "Fix my Trac document",
    faq: [
      {
        q: "What is the Trac jobs upload size limit?",
        a: "No official nationwide byte limit is published. 2MB is a conservative commonly reported target for vacancies that show an upload field. Check that vacancy. Trac does not accept zip files.",
      },
      {
        q: "Can I upload a CV on every Trac vacancy?",
        a: "No. Most Trac vacancies ask you to paste a supporting statement rather than attach a CV. Use this fixer only when that vacancy shows an upload field.",
      },
      PRIVACY_FAQ,
    ],
  },
  "civil-service-jobs": {
    h1: "Civil Service Jobs file too large — compress a CV",
    title: "Civil Service Jobs file too large — compress CV | Chowbea",
    description:
      "GOV.UK says upload a CV or personal statement only when the form asks, one file per question, and not password-protected. No byte cap is published — 5MB is commonly reported.",
    intro:
      "Official GOV.UK candidate guidance: upload a CV or personal statement only when the form asks, one file per question, and do not upload a password-protected file. No byte limit is published. 5MB is a conservative commonly reported target — check the vacancy upload field.",
    limit: "5MB per file (commonly reported — not published on GOV.UK)",
    formats: "PDF, DOC or DOCX",
    extras: [
      "One file per question, only when the form asks",
      "Not password-protected",
    ],
    sourceUrl:
      "https://www.gov.uk/guidance/using-the-civil-service-jobs-website",
    sourceLabel: "GOV.UK: Using the Civil Service Jobs website",
    verified: false,
    lastChecked: LAST_CHECKED,
    ctaLabel: "Fix my Civil Service CV",
    faq: [
      {
        q: "What is the Civil Service Jobs file size limit?",
        a: "GOV.UK lists no byte cap. Upload a CV or personal statement only when the form asks, one file per question, and do not use a password. 5MB is a conservative commonly reported target — check the vacancy upload field.",
      },
      {
        q: "Can I upload a password-protected CV?",
        a: "No. Official candidate guidance says do not upload a password-protected file. Unlock it first, then compress it.",
      },
      PRIVACY_FAQ,
    ],
  },
  "universal-credit": {
    h1: "Universal Credit file too large — compress evidence",
    title: "Universal Credit file too large — compress PDF | Chowbea",
    description:
      "GOV.UK asks for bank statements and other evidence through your Universal Credit account. DWP prefers PDF statements. No per-file byte cap is published — 10MB is commonly reported.",
    intro:
      "GOV.UK claim-review guidance asks for bank statements and other evidence through the Universal Credit account. An official DWP video says to upload bank statements as PDF. No per-file byte limit is published on GOV.UK, so 10MB here is a conservative commonly reported target. To-do lists often cap the number of files (commonly 16) rather than a published megabyte figure.",
    limit: "10MB per file (commonly reported — not published on GOV.UK)",
    formats: "PDF, JPG or PNG (DWP prefers PDF bank statements)",
    extras: [
      "To-do lists often cap the number of files (commonly 16) rather than a published megabyte figure",
    ],
    sourceUrl: "https://www.gov.uk/universal-credit-reviews",
    sourceLabel: "GOV.UK: Universal Credit reviews",
    verified: false,
    lastChecked: LAST_CHECKED,
    ctaLabel: "Fix my Universal Credit file",
    faq: [
      {
        q: "What is the Universal Credit upload size limit?",
        a: "GOV.UK does not publish a per-file byte limit. 10MB is a conservative commonly reported target. To-do lists often cap the number of files (commonly 16) rather than a published megabyte figure.",
      },
      {
        q: "Should I upload bank statements as PDF?",
        a: "An official DWP video says to upload bank statements as PDF. This tool can convert photos of statements to PDF.",
      },
      PRIVACY_FAQ,
    ],
  },
  "council-housing-benefits": {
    h1: "Council housing file too large — compress evidence",
    title: "Council housing file too large — compress evidence | Chowbea",
    description:
      "There is no single national council portal. Wolverhampton publishes 5MB per document; other councils allow more. 5MB is a conservative commonly reported default — check your own form.",
    intro:
      "There is no single national council portal. Limits vary: Wolverhampton publishes 5MB per document; Harrow 10MB (BMP, GIF, JPG, PDF, PNG, DOC); Merton 30MB; Chelmsford a 35MB combined cap. 5MB here is a conservative commonly reported default, not a UK-wide official figure. Check your own council's upload form.",
    limit:
      "5MB per file (conservative default — councils vary; not a UK-wide official figure)",
    formats: "PDF, JPG, PNG or DOC",
    extras: [
      "Wolverhampton publishes 5MB per document",
      "Harrow 10MB; Merton 30MB; Chelmsford a 35MB combined cap",
      "Check your own council's upload form",
    ],
    sourceUrl:
      "https://www.wolverhampton.gov.uk/benefits/housing-benefit-and-council-tax-support/upload-proof-your-benefits-claim",
    sourceLabel: "Wolverhampton: Upload proof for your benefits claim",
    verified: false,
    lastChecked: LAST_CHECKED,
    ctaLabel: "Fix my council evidence",
    faq: [
      {
        q: "What is the UK council housing upload size limit?",
        a: "There is no single national council portal. Wolverhampton publishes 5MB per document; Harrow 10MB; Merton 30MB; Chelmsford a 35MB combined cap. 5MB is a conservative commonly reported default. Check your own council's upload form.",
      },
      {
        q: "Which file types do councils accept?",
        a: "They vary. This tool emits PDF, JPG, PNG or DOC. Harrow also lists BMP and GIF. Check the form you were sent.",
      },
      PRIVACY_FAQ,
    ],
  },
  ofsted: {
    h1: "Ofsted provider portal file too large — compress documents",
    title: "Ofsted portal file too large — compress PDF | Chowbea",
    description:
      "The Ofsted provider portal lets providers upload pre-inspection material. Official GOV.UK portal guidance does not state a byte limit — 5MB is commonly reported.",
    intro:
      "The Ofsted provider portal lets providers upload pre-inspection material. Official GOV.UK portal guidance does not state a byte limit. 5MB is a conservative commonly reported target — check the portal when you upload.",
    limit: "5MB per file (commonly reported — not published on GOV.UK)",
    formats: "PDF, JPEG or DOCX",
    extras: ["Check the portal when you upload"],
    sourceUrl:
      "https://www.gov.uk/government/publications/ofsted-provider-portal-guidance-for-providers",
    sourceLabel: "GOV.UK: Ofsted provider portal guidance for providers",
    verified: false,
    lastChecked: LAST_CHECKED,
    ctaLabel: "Fix my Ofsted document",
    faq: [
      {
        q: "What is the Ofsted provider portal upload size limit?",
        a: "Official GOV.UK portal guidance does not state a byte limit. 5MB is a conservative commonly reported target — check the portal when you upload.",
      },
      {
        q: "What file types does the Ofsted portal accept?",
        a: "This tool emits PDF, JPEG or DOCX for pre-inspection material. Check the portal for the types it lists on the day you upload.",
      },
      PRIVACY_FAQ,
    ],
  },
  sra: {
    h1: "SRA mySRA file too large — compress a supporting document",
    title: "SRA mySRA file too large — compress PDF | Chowbea",
    description:
      "mySRA asks for a supporting document when you change your name. No official byte cap is published — 5MB is a conservative commonly reported target.",
    intro:
      "SRA mySRA asks for a supporting document (for example a marriage certificate) when you change your name. No official byte limit is published. 5MB is a conservative commonly reported target — check the upload field in mySRA.",
    limit: "5MB per file (commonly reported — not published by the SRA)",
    formats: "PDF, JPEG or DOCX",
    extras: ["Check the upload field in mySRA"],
    sourceUrl:
      "https://www.sra.org.uk/mysra/manage-account/individual-account/",
    sourceLabel: "SRA: Manage your individual mySRA account",
    verified: false,
    lastChecked: LAST_CHECKED,
    ctaLabel: "Fix my mySRA document",
    faq: [
      {
        q: "What is the SRA mySRA upload size limit?",
        a: "No official byte limit is published. 5MB is a conservative commonly reported target — check the upload field in mySRA.",
      },
      {
        q: "When does mySRA ask for a document?",
        a: "For example when you change your name, mySRA asks for a supporting document such as a marriage certificate.",
      },
      PRIVACY_FAQ,
    ],
  },
  gmc: {
    h1: "GMC registration file too large — compress evidence",
    title: "GMC registration file too large — compress PDF | Chowbea",
    description:
      "GMC asks for PDF copies of evidence. No applicant per-file byte cap is published — 5MB is commonly reported. GMC Connect and email-evidence channels quote 20MB and are different.",
    intro:
      "GMC asks for PDF copies of evidence on the application. No per-file byte limit is published for applicant uploads. GMC Connect (medical schools) states a 20MB upload limit, and some GMC email-evidence guidance states 20MB per email — those are different channels. 5MB is a conservative commonly reported target for the application form.",
    limit:
      "5MB per file (commonly reported for the application form — not a published applicant cap)",
    formats: "PDF or DOC (PDF preferred)",
    extras: [
      "GMC Connect (medical schools) states a 20MB upload limit — a different channel",
      "Some GMC email-evidence guidance states 20MB per email — a different channel",
    ],
    sourceUrl:
      "https://www.gmc-uk.org/registration-and-licensing/join-our-registers/registration-applications/attaching-your-documents-to-your-application",
    sourceLabel: "GMC: Attaching your documents to your application",
    verified: false,
    lastChecked: LAST_CHECKED,
    ctaLabel: "Fix my GMC evidence",
    faq: [
      {
        q: "What is the GMC registration upload size limit?",
        a: "No per-file byte limit is published for applicant uploads. 5MB is a conservative commonly reported target for the application form. GMC Connect (medical schools) and some email-evidence guidance quote 20MB — those are different channels.",
      },
      {
        q: "What file type does GMC ask for?",
        a: "GMC asks for PDF copies of evidence on the application. This tool also accepts DOC and converts it to PDF.",
      },
      PRIVACY_FAQ,
    ],
  },
  nmc: {
    h1: "NMC registration file too large — compress documents",
    title: "NMC registration file too large — compress PDF | Chowbea",
    description:
      "NMC registration guidance covers certified copies and ID checks. It does not publish a per-file byte cap for the online account — 2MB is commonly reported.",
    intro:
      "NMC registration guidance covers certified copies and ID checks. It does not publish a per-file byte limit for the online account. 2MB is a conservative commonly reported target — check the NMC online upload screen.",
    limit: "2MB per file (commonly reported — not published by the NMC)",
    formats: "PDF, JPG or PNG",
    extras: [
      "Check the NMC online upload screen",
      "Do not post original passports",
    ],
    sourceUrl:
      "https://www.nmc.org.uk/registration/joining-the-register/supplying-documents/",
    sourceLabel: "NMC: Supplying documents",
    verified: false,
    lastChecked: LAST_CHECKED,
    ctaLabel: "Fix my NMC document",
    faq: [
      {
        q: "What is the NMC registration upload size limit?",
        a: "NMC registration guidance does not publish a per-file byte limit for the online account. 2MB is a conservative commonly reported target — check the NMC online upload screen.",
      },
      {
        q: "Should I post original documents to the NMC?",
        a: "No. Upload certified copies through your NMC online account. Do not post original passports.",
      },
      PRIVACY_FAQ,
    ],
  },
  "indeed-cv": {
    h1: "Indeed CV file too large — how to compress under 2MB",
    title: "Indeed CV file too large — compress PDF | Chowbea",
    description:
      "Indeed Help says you can upload one CV at a time and that the file is converted to PDF. It does not publish a megabyte limit — 2MB is commonly reported.",
    intro:
      "Indeed Help says you can upload one CV at a time and that the file is converted to PDF. It does not publish a megabyte limit. 2MB is a conservative commonly reported target, not an official Indeed figure.",
    limit: "2MB (commonly reported — not published by Indeed)",
    formats: "PDF, DOC or DOCX",
    extras: [
      "One CV at a time — Indeed replaces any previous file",
      "Indeed converts uploads to PDF",
    ],
    sourceUrl:
      "https://indeed.zendesk.com/hc/en-gb/articles/11314976176141-FAQs-Creating-uploading-and-managing-a-CV-file",
    sourceLabel: "Indeed Help: Creating, uploading and managing a CV file",
    verified: false,
    lastChecked: LAST_CHECKED,
    ctaLabel: "Fix my Indeed CV",
    faq: [
      {
        q: "What is the Indeed CV file size limit?",
        a: "Indeed Help does not publish a megabyte limit. 2MB is a conservative commonly reported target, not an official Indeed figure. Indeed converts uploads to PDF.",
      },
      {
        q: "Can I keep more than one CV on Indeed?",
        a: "Indeed Help says you can upload one CV at a time. A new file replaces the previous one.",
      },
      PRIVACY_FAQ,
    ],
  },
  "linkedin-cv": {
    h1: "LinkedIn resume file too large (2MB recommended)",
    title: "LinkedIn resume upload size limit (2MB) | Chowbea",
    description:
      "LinkedIn Help: Easy Apply resumes must be Microsoft Word or PDF, and LinkedIn recommends a file size less than 2MB. That figure is a published recommendation rather than a hard error message.",
    intro:
      "LinkedIn Help says an Easy Apply resume must be Microsoft Word or PDF, and LinkedIn recommends a file size less than 2MB. That 2MB figure is a published recommendation rather than a hard error message.",
    limit: "Under 2MB (LinkedIn published recommendation)",
    formats: "Microsoft Word or PDF",
    extras: ["2MB is a published recommendation, not a hard error message"],
    sourceUrl:
      "https://www.linkedin.com/help/linkedin/answer/a510363/upload-your-resume-to-linkedin",
    sourceLabel: "LinkedIn Help: Upload your resume to LinkedIn",
    verified: true,
    lastChecked: LAST_CHECKED,
    ctaLabel: "Fix my LinkedIn resume",
    faq: [
      {
        q: "What is the LinkedIn resume upload size limit?",
        a: "LinkedIn Help recommends a file size less than 2MB for Easy Apply. That 2MB figure is a published recommendation rather than a hard error message. Resumes must be Microsoft Word or PDF.",
      },
      {
        q: "Where do I upload a LinkedIn resume?",
        a: "On Easy Apply, or under Jobs → Preferences → Resumes.",
      },
      PRIVACY_FAQ,
    ],
  },
  openrent: {
    h1: "OpenRent referencing file too large — compress ID",
    title: "OpenRent referencing file too large — compress ID | Chowbea",
    description:
      "OpenRent referencing accepts a copy of an identity document (passport preferred). It does not publish a byte limit — 5MB is commonly reported for the ID scan.",
    intro:
      "OpenRent referencing accepts a copy of an identity document (passport preferred). It does not accept tenant-uploaded bank statements, payslips or employment contracts for the assessment, and it does not publish a byte limit. 5MB is a conservative commonly reported target for the ID scan.",
    limit: "5MB (commonly reported — not published by OpenRent)",
    formats: "PDF, JPG or PNG (JPEG preferred)",
    extras: [
      "Passport preferred as the identity document",
      "OpenRent does not take tenant-uploaded bank statements, payslips or employment contracts for this assessment",
    ],
    sourceUrl:
      "https://help.openrent.co.uk/hc/en-gb/articles/11461385143313-Which-proof-of-identity-documents-do-you-accept",
    sourceLabel:
      "OpenRent Help: Which proof of identity documents do you accept",
    verified: false,
    lastChecked: LAST_CHECKED,
    ctaLabel: "Fix my OpenRent ID",
    faq: [
      {
        q: "What is the OpenRent referencing file size limit?",
        a: "OpenRent does not publish a byte limit. 5MB is a conservative commonly reported target for the ID scan.",
      },
      {
        q: "Can I upload bank statements to OpenRent referencing?",
        a: "No. OpenRent referencing accepts a copy of an identity document (passport preferred). It does not accept tenant-uploaded bank statements, payslips or employment contracts for the assessment.",
      },
      PRIVACY_FAQ,
    ],
  },
  "pip-evidence": {
    h1: "PIP evidence file too large — compress supporting documents",
    title: "PIP evidence file too large — compress PDF | Chowbea",
    description:
      "GOV.UK explains how to claim PIP and that you can send supporting evidence. It does not publish a per-file byte cap — 10MB is commonly reported.",
    intro:
      "GOV.UK explains how to claim PIP and that you can send supporting evidence. It does not publish a per-file byte limit. 10MB is a conservative commonly reported target for the online evidence upload. If a file is still too large, split pages rather than dropping evidence.",
    limit: "10MB per file (commonly reported — not published on GOV.UK)",
    formats: "PDF, JPG or PNG",
    extras: [
      "If a file is still too large, split pages rather than dropping evidence",
    ],
    sourceUrl: "https://www.gov.uk/pip/how-to-claim",
    sourceLabel: "GOV.UK: How to claim PIP",
    verified: false,
    lastChecked: LAST_CHECKED,
    ctaLabel: "Fix my PIP evidence",
    faq: [
      {
        q: "What is the PIP evidence upload size limit?",
        a: "GOV.UK does not publish a per-file byte limit. 10MB is a conservative commonly reported target for the online evidence upload. If a file is still too large, split pages rather than dropping evidence.",
      },
      {
        q: "What can I send as PIP supporting evidence?",
        a: "Medical letters, prescriptions or a diary as PDF or photos. Upload it with the PIP claim, or send copies to DWP with your National Insurance number.",
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
    "Short guides for UK passport photos, HMRC, UCAS, Student Finance, SAAS, LinkedIn, DVLA, Universal Credit and more. Each page quotes the official or commonly reported limit with a source link, then a free fixer.",
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
