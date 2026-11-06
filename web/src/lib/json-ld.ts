/**
 * schema.org JSON-LD payloads for the fixer. Shapes are checked in tests
 * against the properties schema.org and Google Search expect.
 */

import { GUIDE_IDS, GUIDES_SEO, guideFor, guideSteps } from "./guides"
import { PORTAL_IDS, categoryForPreset } from "./portal-catalogue"
import { publicUrl, seoForPreset } from "./preset-seo"
import { ogCard } from "./og-copy"

export type JsonLdObject = Record<string, unknown>

/** WebApplication + SoftwareApplication describing the free fixer. */
export function webAppJsonLd(
  url: string,
  name: string,
  description: string
): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": ["WebApplication", "SoftwareApplication"],
    name,
    applicationCategory: "MultimediaApplication",
    operatingSystem: "Web",
    offers: { "@type": "Offer", price: "0", priceCurrency: "GBP" },
    description,
    url,
  }
}

/** Breadcrumb from Home through the category index to this preset page. */
export function breadcrumbJsonLd(presetId: string): JsonLdObject {
  const seo = seoForPreset(presetId)
  const card = ogCard(presetId)
  const category = categoryForPreset(presetId)
  const categoryCrumb =
    category === "generic"
      ? {
          name: "Upload fixer",
          item: publicUrl("/fix"),
        }
      : {
          name: "UK portals",
          item: publicUrl("/portals"),
        }

  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: publicUrl("/"),
      },
      {
        "@type": "ListItem",
        position: 2,
        name: categoryCrumb.name,
        item: categoryCrumb.item,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: card.name || seo.h1,
        item: publicUrl(`/fix/${presetId}`),
      },
    ],
  }
}

/** Breadcrumb from Home through /guides to one how-to page. */
export function guideBreadcrumbJsonLd(slug: string): JsonLdObject {
  const guide = guideFor(slug)
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: publicUrl("/"),
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Guides",
        item: publicUrl("/guides"),
      },
      {
        "@type": "ListItem",
        position: 3,
        name: guide?.h1 ?? slug,
        item: publicUrl(`/guides/${slug}`),
      },
    ],
  }
}

/** ItemList of every how-to guide on /guides, in portal-category order. */
export function guidesItemListJsonLd(): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: GUIDES_SEO.h1,
    description: GUIDES_SEO.description,
    numberOfItems: GUIDE_IDS.length,
    itemListOrder: "https://schema.org/ItemListOrderAscending",
    itemListElement: GUIDE_IDS.map((id, index) => {
      const guide = guideFor(id)
      const url = publicUrl(`/guides/${id}`)
      const name = guide?.h1 ?? id
      return {
        "@type": "ListItem",
        position: index + 1,
        name,
        url,
        item: {
          "@type": "WebPage",
          "@id": url,
          name,
          url,
        },
      }
    }),
  }
}

/** ItemList of every UK portal on /portals, in category order. */
export function portalsItemListJsonLd(): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "UK portal upload limits",
    description:
      "Compress a PDF or photo to the upload limit for UK government, jobs, education, housing and health portals.",
    numberOfItems: PORTAL_IDS.length,
    itemListOrder: "https://schema.org/ItemListOrderAscending",
    itemListElement: PORTAL_IDS.map((id, index) => {
      const seo = seoForPreset(id)
      const url = publicUrl(`/fix/${id}`)
      return {
        "@type": "ListItem",
        position: index + 1,
        name: seo.h1,
        url,
        item: {
          "@type": "WebPage",
          "@id": url,
          name: seo.h1,
          url,
        },
      }
    }),
  }
}

/** HowTo with numbered steps from guide content. */
export function guideHowToJsonLd(slug: string): JsonLdObject {
  const guide = guideFor(slug)
  if (!guide) {
    return {
      "@context": "https://schema.org",
      "@type": "HowTo",
      name: slug,
      description: "",
      url: publicUrl(`/guides/${slug}`),
      step: [],
    }
  }

  const steps = guideSteps(slug)
  const url = publicUrl(`/guides/${slug}`)
  const card = ogCard(guide.presetId)

  return {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: guide.h1,
    description: guide.intro,
    url,
    step: steps.map((text, index) => ({
      "@type": "HowToStep",
      position: index + 1,
      name: text,
      text,
    })),
    ...(card.image ? { image: card.image } : {}),
  }
}

const SCHEMA_CONTEXT = "https://schema.org"

/** Narrow a JSON-LD node to a plain object. */
function asRecord(value: unknown): JsonLdObject | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonLdObject)
    : null
}

/** True when @type is the name, or an array that includes it. */
function hasType(value: unknown, typeName: string): boolean {
  if (typeof value === "string") return value === typeName
  return Array.isArray(value) && value.includes(typeName)
}

/** Absolute https URL — schema.org item/url fields must be crawlable. */
function httpsUrl(value: unknown): boolean {
  return typeof value === "string" && value.startsWith("https://")
}

/** schema.org WebApplication / SoftwareApplication required fields. */
export function webApplicationErrors(payload: JsonLdObject): string[] {
  const errors: string[] = []
  if (payload["@context"] !== SCHEMA_CONTEXT) {
    errors.push("@context must be https://schema.org")
  }
  if (
    !hasType(payload["@type"], "WebApplication") &&
    !hasType(payload["@type"], "SoftwareApplication")
  ) {
    errors.push("@type must include WebApplication or SoftwareApplication")
  }
  if (typeof payload.name !== "string" || payload.name.length === 0) {
    errors.push("name is required")
  }
  if (!httpsUrl(payload.url)) errors.push("url must be an https URL")
  if (
    typeof payload.description !== "string" ||
    payload.description.length < 8
  ) {
    errors.push("description is required")
  }
  if (typeof payload.applicationCategory !== "string") {
    errors.push("applicationCategory is required")
  }
  if (typeof payload.operatingSystem !== "string") {
    errors.push("operatingSystem is required")
  }
  const offers = asRecord(payload.offers)
  if (!offers || offers["@type"] !== "Offer") {
    errors.push("offers must be an Offer")
  } else {
    if (typeof offers.price !== "string" && typeof offers.price !== "number") {
      errors.push("offers.price is required")
    }
    if (typeof offers.priceCurrency !== "string") {
      errors.push("offers.priceCurrency is required")
    }
  }
  return errors
}

/** schema.org BreadcrumbList with sequential ListItem positions. */
export function breadcrumbListErrors(payload: JsonLdObject): string[] {
  const errors: string[] = []
  if (payload["@context"] !== SCHEMA_CONTEXT) {
    errors.push("@context must be https://schema.org")
  }
  if (!hasType(payload["@type"], "BreadcrumbList")) {
    errors.push("@type must be BreadcrumbList")
  }
  if (!Array.isArray(payload.itemListElement)) {
    errors.push("itemListElement must be an array")
    return errors
  }
  payload.itemListElement.forEach((entry, index) => {
    const item = asRecord(entry)
    if (!item) {
      errors.push(`itemListElement[${index}] must be an object`)
      return
    }
    if (item["@type"] !== "ListItem") {
      errors.push(`itemListElement[${index}] @type must be ListItem`)
    }
    if (item.position !== index + 1) {
      errors.push(`itemListElement[${index}] position must be ${index + 1}`)
    }
    if (typeof item.name !== "string" || item.name.length === 0) {
      errors.push(`itemListElement[${index}] name is required`)
    }
    if (!httpsUrl(item.item)) {
      errors.push(`itemListElement[${index}] item must be an https URL`)
    }
  })
  if (payload.itemListElement.length < 2) {
    errors.push("BreadcrumbList needs at least two items")
  }
  return errors
}

/** schema.org ItemList of portal pages. */
export function itemListErrors(payload: JsonLdObject): string[] {
  const errors: string[] = []
  if (payload["@context"] !== SCHEMA_CONTEXT) {
    errors.push("@context must be https://schema.org")
  }
  if (!hasType(payload["@type"], "ItemList")) {
    errors.push("@type must be ItemList")
  }
  if (typeof payload.name !== "string" || payload.name.length === 0) {
    errors.push("name is required")
  }
  if (!Array.isArray(payload.itemListElement)) {
    errors.push("itemListElement must be an array")
    return errors
  }
  if (
    payload.numberOfItems !== undefined &&
    payload.numberOfItems !== payload.itemListElement.length
  ) {
    errors.push("numberOfItems must match itemListElement length")
  }
  payload.itemListElement.forEach((entry, index) => {
    const item = asRecord(entry)
    if (!item) {
      errors.push(`itemListElement[${index}] must be an object`)
      return
    }
    if (item["@type"] !== "ListItem") {
      errors.push(`itemListElement[${index}] @type must be ListItem`)
    }
    if (item.position !== index + 1) {
      errors.push(`itemListElement[${index}] position must be ${index + 1}`)
    }
    if (typeof item.name !== "string" || item.name.length === 0) {
      errors.push(`itemListElement[${index}] name is required`)
    }
    const url = typeof item.url === "string" ? item.url : null
    const nested = asRecord(item.item)
    const nestedUrl =
      typeof nested?.url === "string"
        ? nested.url
        : typeof nested?.["@id"] === "string"
          ? nested["@id"]
          : typeof item.item === "string"
            ? item.item
            : null
    if (!httpsUrl(url) && !httpsUrl(nestedUrl)) {
      errors.push(`itemListElement[${index}] needs an https url or item`)
    }
  })
  return errors
}

/** schema.org HowTo with step array. */
export function howToErrors(payload: JsonLdObject): string[] {
  const errors: string[] = []
  if (payload["@context"] !== SCHEMA_CONTEXT) {
    errors.push("@context must be https://schema.org")
  }
  if (!hasType(payload["@type"], "HowTo")) {
    errors.push("@type must be HowTo")
  }
  if (typeof payload.name !== "string" || payload.name.length === 0) {
    errors.push("name is required")
  }
  if (!httpsUrl(payload.url)) {
    errors.push("url must be an https URL")
  }
  if (!Array.isArray(payload.step)) {
    errors.push("step must be an array")
    return errors
  }
  if (payload.step.length === 0) {
    errors.push("step array must not be empty")
  }
  payload.step.forEach((entry, index) => {
    const item = asRecord(entry)
    if (!item) {
      errors.push(`step[${index}] must be an object`)
      return
    }
    if (item["@type"] !== "HowToStep") {
      errors.push(`step[${index}] @type must be HowToStep`)
    }
    if (item.position !== index + 1) {
      errors.push(`step[${index}] position must be ${index + 1}`)
    }
    const hasName = typeof item.name === "string" && item.name.length > 0
    const hasText = typeof item.text === "string" && item.text.length > 0
    if (!hasName && !hasText) {
      errors.push(`step[${index}] must have name or text`)
    }
  })
  return errors
}
