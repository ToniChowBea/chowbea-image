// @vitest-environment jsdom
import type { ReactNode } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, render, screen } from "@testing-library/react"

import { GuideArticle } from "./guide-article"
import { GuidesIndex } from "./guides-index"
import { GuideLink } from "./guide-link"
import { GUIDE_IDS, guideFor } from "@/lib/guides"

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    to,
    params,
    children,
    ...props
  }: {
    to: string
    params?: { slug?: string; preset?: string }
    children: ReactNode
    [key: string]: unknown
  }) => {
    const href = params?.slug
      ? `/guides/${params.slug}`
      : params?.preset
        ? `/fix/${params.preset}`
        : to
    return (
      <a href={href} {...props}>
        {children}
      </a>
    )
  },
}))

/** JSON-LD payloads emitted into the document by <JsonLd>. */
function jsonLdPayloads(): Array<Record<string, unknown>> {
  return [
    ...document.querySelectorAll('script[type="application/ld+json"]'),
  ].map((node) => JSON.parse(node.innerHTML) as Record<string, unknown>)
}

afterEach(() => {
  cleanup()
})

describe("GuideArticle", () => {
  it("renders the passport H1, official source, CTA, FAQ and JSON-LD", () => {
    const guide = guideFor("uk-passport-online")
    expect(guide).toBeTruthy()
    render(<GuideArticle guide={guide!} />)

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: /how to resize a photo for a uk passport online/i,
      })
    ).toBeTruthy()
    expect(screen.getByText("Size: 50KB–10MB")).toBeTruthy()
    const source = screen.getByRole("link", {
      name: /gov\.uk: photos for passports/i,
    })
    expect(source.getAttribute("href")).toBe(
      "https://www.gov.uk/photos-for-passports"
    )
    const cta = screen.getByRole("link", { name: /resize my passport photo/i })
    expect(cta.getAttribute("href")).toBe("/fix/uk-passport-online")

    const payloads = jsonLdPayloads()
    const faq = payloads.find((item) => item["@type"] === "FAQPage")
    const crumbs = payloads.find((item) => item["@type"] === "BreadcrumbList")
    expect(faq).toBeTruthy()
    expect(crumbs).toBeTruthy()
    const questions = (faq?.mainEntity as Array<{ name: string }>) ?? []
    expect(
      questions.some((item) => /passport photo size limit/i.test(item.name))
    ).toBe(true)
    const items = (crumbs?.itemListElement as Array<{ item: string }>) ?? []
    expect(items.map((item) => item.item)).toEqual([
      "https://img.chowbea.com/",
      "https://img.chowbea.com/guides",
      "https://img.chowbea.com/guides/uk-passport-online",
    ])
  })

  it("labels the Student visa CAS limit as commonly reported", () => {
    const guide = guideFor("student-visa-cas")
    render(<GuideArticle guide={guide!} />)
    expect(screen.getByText("Unverified")).toBeTruthy()
    expect(screen.getByText(/6MB per file \(commonly reported/i)).toBeTruthy()
    const cta = screen.getByRole("link", {
      name: /fix my student visa evidence/i,
    })
    expect(cta.getAttribute("href")).toBe("/fix/student-visa-cas")
  })

  it("renders a verified SAAS guide with the official source and fixer CTA", () => {
    const guide = guideFor("saas-documents")
    render(<GuideArticle guide={guide!} />)
    expect(screen.getByText("Verified")).toBeTruthy()
    expect(
      screen.getByText("Size: 5MB per file (max 5 files per transaction)")
    ).toBeTruthy()
    const source = screen.getByRole("link", {
      name: /saas: document upload service guide/i,
    })
    expect(source.getAttribute("href")).toBe(
      "https://www.edocs.saas.gov.uk/help/document_upload_guide.pdf"
    )
    const cta = screen.getByRole("link", { name: /fix my saas document/i })
    expect(cta.getAttribute("href")).toBe("/fix/saas-documents")
  })
})

describe("GuidesIndex", () => {
  it("lists every guide grouped like /portals and emits ItemList JSON-LD", () => {
    render(<GuidesIndex />)
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: /how to fix a file for a uk portal/i,
      })
    ).toBeTruthy()
    expect(screen.getByRole("heading", { name: /immigration/i })).toBeTruthy()
    expect(
      screen.getByRole("heading", { name: /tax and government/i })
    ).toBeTruthy()
    expect(
      screen.getByRole("link", { name: /all uk portals/i }).getAttribute("href")
    ).toBe("/portals")

    for (const id of GUIDE_IDS) {
      const guide = guideFor(id)!
      const link = screen.getByRole("link", {
        name: (name) => name.includes(guide.h1),
      })
      expect(link.getAttribute("href")).toBe(`/guides/${id}`)
    }

    const payloads = jsonLdPayloads()
    const list = payloads.find((item) => item["@type"] === "ItemList")
    expect(list?.numberOfItems).toBe(GUIDE_IDS.length)
    const faq = payloads.find((item) => item["@type"] === "FAQPage")
    expect(faq).toBeTruthy()
  })
})

describe("GuideLink", () => {
  it("points a matching /fix page at its guide", () => {
    render(<GuideLink presetId="ucas-documents" />)
    const link = screen.getByRole("link", {
      name: /need help\? read the guide/i,
    })
    expect(link.getAttribute("href")).toBe("/guides/ucas-documents")
  })

  it("hides when that preset has no guide", () => {
    const { container } = render(<GuideLink presetId="jpg-1mb" />)
    expect(container.textContent).toBe("")
  })

  it("points new remaining-portal /fix pages at their guides", () => {
    render(<GuideLink presetId="linkedin-cv" />)
    expect(
      screen
        .getByRole("link", { name: /need help\? read the guide/i })
        .getAttribute("href")
    ).toBe("/guides/linkedin-cv")
  })

  it("stays hidden for skipped portals without a verified source/limit", () => {
    const vfs = render(<GuideLink presetId="vfs-global" />)
    expect(vfs.container.textContent).toBe("")
    vfs.unmount()
    const rightmove = render(<GuideLink presetId="rightmove" />)
    expect(rightmove.container.textContent).toBe("")
  })
})
