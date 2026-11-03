/**
 * UK portal grouping, slugs, and step copy used by /portals and /fix pages.
 * Limits live in the API YAML; this file is the crawlable web catalogue.
 */

export const PORTAL_CATEGORIES = [
  { id: "immigration", title: "Immigration" },
  { id: "tax-government", title: "Tax and government" },
  { id: "jobs", title: "Jobs" },
  { id: "education", title: "Education" },
  { id: "housing", title: "Housing" },
  { id: "health", title: "Health" },
] as const

export type PortalCategoryId = (typeof PORTAL_CATEGORIES)[number]["id"]

/** Portal slugs grouped in the order /portals renders them. */
export const PORTAL_IDS_BY_CATEGORY: Record<
  PortalCategoryId,
  readonly string[]
> = {
  immigration: [
    "uk-passport-online",
    "uk-visa-face",
    "ukvi-evidence",
    "eu-settlement",
    "student-visa-cas",
    "ukvcas",
    "vfs-global",
  ],
  "tax-government": [
    "dvla-photo",
    "hmrc-compliance",
    "hmrc-cds",
    "companies-house",
    "universal-credit",
    "dbs",
    "sra",
    "hmcts-efiling",
  ],
  jobs: [
    "nhs-jobs",
    "trac-jobs",
    "civil-service-jobs",
    "indeed-cv",
    "linkedin-cv",
  ],
  education: [
    "ucas-documents",
    "saas-documents",
    "student-finance-england",
    "ofsted",
  ],
  housing: [
    "council-housing-benefits",
    "land-registry",
    "rightmove",
    "openrent",
  ],
  health: ["gmc", "nmc", "pip-evidence"],
}

/** Every UK portal slug, category order flattened. */
export const PORTAL_IDS = PORTAL_CATEGORIES.flatMap(
  (category) => PORTAL_IDS_BY_CATEGORY[category.id]
)

/** Generic size-target slugs — listed on /fix, not on /portals. */
export const GENERIC_IDS = [
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

/** Catalogue ids in sitemap and /fix fallback order. */
export const PRESET_IDS = [...PORTAL_IDS, ...GENERIC_IDS] as const

export type PresetId = (typeof PRESET_IDS)[number]

const DEFAULT_STEPS = [
  "Drop your file — a photo, PDF or Word document is fine.",
  "Hit Fix. We convert, resize and compress to this portal's rules.",
  "Download the result and upload it on the portal.",
]

/** Short how-to copy shown on each preset landing page. */
const STEPS: Record<string, string[]> = {
  "uk-passport-online": [
    "Drop a colour photo. HEIC from an iPhone is converted to JPEG.",
    "We meet GOV.UK's 600×750 minimum and stay between 50KB and 10MB. We do not crop.",
    "Download the JPEG and add it to your GOV.UK passport application.",
  ],
  "uk-visa-face": [
    "Drop a portrait photo. Phone HEIC is converted to JPEG.",
    "We keep it colour, portrait, at least 600×750, and between 50KB and 6MB.",
    "Download and upload it on the visa application.",
  ],
  "ucas-documents": [
    "Drop a transcript, reference or certificate (PDF, JPEG or ODT).",
    "Unlock any password, then hit Fix to stay under 5MB.",
    "Download and upload it on your UCAS application.",
  ],
  "saas-documents": [
    "Drop a JPG, TIFF or PDF of the evidence SAAS asked for.",
    "Hit Fix to stay under 5MB per file.",
    "Upload it through the SAAS document service (max 5 files per transaction).",
  ],
  ukvcas: [
    "Drop a PDF, JPG or PNG. Greyscale scans are usually smaller.",
    "Hit Fix to stay under 6MB and drop any password.",
    "Upload it in your UKVCAS account before the appointment.",
  ],
  "vfs-global": [
    "Drop a PDF, JPG or PNG. Country VACs differ — check yours.",
    "Hit Fix to aim under 2MB, a conservative commonly reported target.",
    "Upload it on the VFS Global page for your application.",
  ],
  "nhs-jobs": [
    "Drop a DOC, DOCX or PDF supporting document (not a CV — NHS Jobs pastes CVs as text).",
    "Hit Fix to stay under 1MB. Oversize Word files become PDF.",
    "Attach it on the job listing if the form asks for supporting documents.",
  ],
  "ukvi-evidence": [
    "Drop a scan or photo of the evidence the application checklist asked for.",
    "Hit Fix for PDF, JPG or PNG under a commonly reported 6MB cap.",
    "Upload it next to that evidence item on the GOV.UK application.",
  ],
  "eu-settlement": [
    "Drop dated residence evidence with your name on it (max 10 files on GOV.UK).",
    "Hit Fix to stay under 6MB per document.",
    "Upload the files on the EU Settlement Scheme application — do not post originals.",
  ],
  "student-visa-cas": [
    "Keep the CAS number for the form. Drop finance, TB or guardian documents here.",
    "Hit Fix for PDF, JPG or PNG under a commonly reported 6MB cap.",
    "Upload the evidence on the Student visa application, then enter the CAS number separately.",
  ],
  "dvla-photo": [
    "Drop a recent colour photo. We convert HEIC to JPEG and do not crop.",
    "Hit Fix to aim for 50KB–10MB and 600×750 — commonly reported, not a DVLA-published figure.",
    "Upload it when GOV.UK asks for a new driving-licence photo.",
  ],
  "hmrc-compliance": [
    "Drop the PDF, JPEG, Word or ODT HMRC asked for (up to 10 files per batch).",
    "Hit Fix to stay under 15MB per file.",
    "Upload it on the HMRC compliance-check form with the case reference.",
  ],
  "hmrc-cds": [
    "Drop a JPG, PNG or PDF that supports the declaration.",
    "Hit Fix to stay under 10MB. You can send up to 10 files at a time.",
    "Upload it on the Customs Declaration Service documents form.",
  ],
  "student-finance-england": [
    "Drop the evidence Student Finance England asked for — only once, and only if they asked.",
    "Hit Fix to stay under 16MB.",
    "Upload it from your student-finance account under Upload supporting evidence.",
  ],
  "trac-jobs": [
    "Drop a supporting document only if that vacancy shows an upload field.",
    "Hit Fix to aim under 2MB, a conservative commonly reported target. Trac rejects zip files.",
    "Attach it on the Trac application, or paste a supporting statement if there is no upload.",
  ],
  "civil-service-jobs": [
    "Drop a CV or personal statement only when the form asks for one file.",
    "Unlock any password, then hit Fix to aim under 5MB (commonly reported).",
    "Upload it in the Civil Service Jobs document section for that question.",
  ],
  "universal-credit": [
    "Drop bank statements as PDF if you can, or a photo of other evidence.",
    "Hit Fix to aim under 10MB, a commonly reported cap. Merge extras if the to-do limits file count.",
    "Upload it from the Universal Credit to-do list, then check the journal.",
  ],
  "council-housing-benefits": [
    "Drop proof of ID, rent or income for the council form you were sent.",
    "Hit Fix to aim under 5MB — a conservative default; some councils allow more.",
    "Upload it on your council's housing, Housing Benefit or Council Tax Reduction form.",
  ],
  "land-registry": [
    "Drop a plan as GIF, JPEG, PDF or TIFF.",
    "Hit Fix to stay under 40MB.",
    "Attach it in the HM Land Registry portal (for example an official search of part).",
  ],
  "companies-house": [
    "Complete the Companies House form first, then drop the PDF here.",
    "Hit Fix to stay under 4MB. Merge continuation pages into one PDF.",
    "Upload one document at a time on the Companies House upload service.",
  ],
  ofsted: [
    "Drop the pre-inspection PDF or Word file Ofsted asked for.",
    "Hit Fix to aim under 5MB, a commonly reported target.",
    "Upload it in the Ofsted provider portal documents section.",
  ],
  sra: [
    "Drop the supporting PDF mySRA asked for, such as a name-change certificate.",
    "Hit Fix to aim under 5MB, a commonly reported target.",
    "Upload it in your mySRA profile and save.",
  ],
  gmc: [
    "Drop PDF evidence against the correct GMC application section.",
    "Hit Fix to aim under 5MB, a commonly reported target for applicant uploads.",
    "Attach it in GMC Online before you submit — you cannot edit afterwards.",
  ],
  nmc: [
    "Drop a certified copy scan (identity or qualification) as PDF or an image.",
    "Hit Fix to aim under 2MB, a commonly reported target.",
    "Upload it on your NMC online account. Do not post original passports.",
  ],
  dbs: [
    "Drop statements, reports or ID scans. Unlock any password first.",
    "Hit Fix to stay under 10MB per file (DBS's published online-upload cap).",
    "Upload it on the DBS service you were sent, or the employer portal if they host ID checks.",
  ],
  "indeed-cv": [
    "Drop one CV as PDF or Word. Indeed replaces any previous file.",
    "Hit Fix to aim under 2MB, a commonly reported target.",
    "Upload it on your Indeed CV tab or during Apply.",
  ],
  "linkedin-cv": [
    "Drop a Word or PDF resume.",
    "Hit Fix to stay under LinkedIn's published 2MB recommendation.",
    "Upload it on Easy Apply or under Jobs → Preferences → Resumes.",
  ],
  rightmove: [
    "Drop an ID or proof-of-address scan if the listing or referencing flow asks for one.",
    "Hit Fix to aim under 5MB, a commonly reported target.",
    "Upload it on the Rightmove or referencing screen in front of you.",
  ],
  openrent: [
    "Drop a passport or other accepted ID scan. OpenRent does not take bank statements here.",
    "Hit Fix to aim under 5MB, a commonly reported target.",
    "Upload it on the OpenRent referencing application.",
  ],
  "hmcts-efiling": [
    "Drop a court PDF. Unlock any password first.",
    "Hit Fix to stay under 50MB per document (up to 10 per filing).",
    "Upload it on HMCTS e-Filing, one document at a time.",
  ],
  "pip-evidence": [
    "Drop medical letters, prescriptions or a diary as PDF or photos.",
    "Hit Fix to aim under 10MB, a commonly reported target. Split pages if needed.",
    "Upload it with the PIP claim, or send copies to DWP with your National Insurance number.",
  ],
}

/** Three short steps for a preset page; generic copy if the id is unknown. */
export function stepsForPreset(id: string, name = "this portal"): string[] {
  const custom = STEPS[id]
  if (custom) return custom
  return [
    DEFAULT_STEPS[0],
    `Hit Fix. We convert, resize and compress to ${name} rules.`,
    DEFAULT_STEPS[2],
  ]
}

/** Look up which /portals group a slug belongs to. */
export function categoryForPreset(id: string): PortalCategoryId | "generic" {
  for (const category of PORTAL_CATEGORIES) {
    if (PORTAL_IDS_BY_CATEGORY[category.id].includes(id)) return category.id
  }
  return "generic"
}

/**
 * 3–4 neighbouring presets in the same category. Generic JPG/PDF targets
 * stay inside their own family so a 100 KB JPEG page does not link to PDFs.
 */
export function relatedPresetIds(id: string, count = 4): string[] {
  const category = categoryForPreset(id)
  const pool: readonly string[] =
    category === "generic"
      ? GENERIC_IDS.filter((other) =>
          other.startsWith(id.startsWith("pdf-") ? "pdf-" : "jpg-")
        )
      : PORTAL_IDS_BY_CATEGORY[category]
  const index = pool.indexOf(id)
  if (index < 0) return []
  return [...pool.slice(index + 1), ...pool.slice(0, index)].slice(0, count)
}
