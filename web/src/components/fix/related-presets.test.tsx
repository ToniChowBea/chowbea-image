// @vitest-environment jsdom
import type { ReactNode } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, render, screen } from "@testing-library/react"

import { RelatedPresets } from "./related-presets"

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    to,
    params,
    children,
    ...props
  }: {
    to: string
    params?: { preset: string }
    children: ReactNode
    [key: string]: unknown
  }) => (
    <a href={params?.preset ? `/fix/${params.preset}` : to} {...props}>
      {children}
    </a>
  ),
}))

describe("RelatedPresets", () => {
  afterEach(() => {
    cleanup()
  })

  it("links to other immigration portals from a passport page", () => {
    render(<RelatedPresets presetId="uk-passport-online" />)
    expect(screen.getByText("Related portals")).toBeTruthy()
    const links = screen.getAllByRole("link")
    expect(links.length).toBeGreaterThanOrEqual(3)
    expect(links.length).toBeLessThanOrEqual(4)
    expect(
      links.every((link) => link.getAttribute("href")?.startsWith("/fix/"))
    ).toBe(true)
    expect(
      links.some((link) =>
        link.getAttribute("href")?.includes("uk-passport-online")
      )
    ).toBe(false)
  })

  it("keeps generic JPG targets in the JPG family", () => {
    render(<RelatedPresets presetId="jpg-100kb" />)
    expect(screen.getByText("Related size targets")).toBeTruthy()
    const hrefs = screen
      .getAllByRole("link")
      .map((link) => link.getAttribute("href") ?? "")
    expect(hrefs.every((href) => href.includes("/fix/jpg-"))).toBe(true)
    expect(hrefs.some((href) => href.includes("pdf-"))).toBe(false)
  })
})
