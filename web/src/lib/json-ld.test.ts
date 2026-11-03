import { describe, expect, it } from "vitest"

import { PORTAL_IDS } from "./portal-catalogue"
import {
  breadcrumbJsonLd,
  breadcrumbListErrors,
  itemListErrors,
  portalsItemListJsonLd,
  webAppJsonLd,
  webApplicationErrors,
} from "./json-ld"

describe("schema.org JSON-LD", () => {
  it("emits a WebApplication/SoftwareApplication that matches schema.org", () => {
    const payload = webAppJsonLd(
      "https://img.chowbea.com/",
      "Chowbea Image",
      "Fix a file to a UK portal upload limit."
    )
    expect(webApplicationErrors(payload)).toEqual([])
    expect(payload["@type"]).toEqual([
      "WebApplication",
      "SoftwareApplication",
    ])
    expect(payload.applicationCategory).toBe("MultimediaApplication")
    const offers = payload.offers as { price: string; priceCurrency: string }
    expect(offers.price).toBe("0")
    expect(offers.priceCurrency).toBe("GBP")
  })

  it("emits a BreadcrumbList for a portal preset", () => {
    const payload = breadcrumbJsonLd("ucas-documents")
    expect(breadcrumbListErrors(payload)).toEqual([])
    const items = payload.itemListElement as Array<{
      name: string
      item: string
      position: number
    }>
    expect(items.map((item) => item.item)).toEqual([
      "https://img.chowbea.com/",
      "https://img.chowbea.com/portals",
      "https://img.chowbea.com/fix/ucas-documents",
    ])
    expect(items[1]?.name).toBe("UK portals")
  })

  it("points generic size targets at /fix in the breadcrumb", () => {
    const payload = breadcrumbJsonLd("jpg-1mb")
    expect(breadcrumbListErrors(payload)).toEqual([])
    const items = payload.itemListElement as Array<{ item: string }>
    expect(items[1]?.item).toBe("https://img.chowbea.com/fix")
  })

  it("emits an ItemList of every UK portal for /portals", () => {
    const payload = portalsItemListJsonLd()
    expect(itemListErrors(payload)).toEqual([])
    expect(payload.numberOfItems).toBe(PORTAL_IDS.length)
    const items = payload.itemListElement as Array<{
      position: number
      url: string
    }>
    expect(items).toHaveLength(PORTAL_IDS.length)
    expect(items[0]?.position).toBe(1)
    expect(items.at(-1)?.position).toBe(PORTAL_IDS.length)
    expect(items.some((item) => item.url.includes("/fix/ucas-documents"))).toBe(
      true
    )
  })

  it("rejects payloads that drop required schema.org fields", () => {
    expect(
      webApplicationErrors({ "@context": "https://schema.org", "@type": "Thing" })
    ).not.toEqual([])
    expect(
      breadcrumbListErrors({
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [],
      })
    ).not.toEqual([])
    expect(
      itemListErrors({
        "@context": "https://schema.org",
        "@type": "ItemList",
        itemListElement: [{ "@type": "Thing" }],
      })
    ).not.toEqual([])
  })
})
