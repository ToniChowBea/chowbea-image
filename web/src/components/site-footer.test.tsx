// @vitest-environment jsdom
import type { ReactNode } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, render, screen } from "@testing-library/react"

import { usageStatsUrl } from "@/lib/usage-stats"

import { SiteFooter } from "./site-footer"

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    to,
    children,
    ...props
  }: {
    to: string
    children: ReactNode
    [key: string]: unknown
  }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}))

afterEach(() => {
  cleanup()
})

describe("SiteFooter", () => {
  it("keeps the privacy nav link and explains anonymous usage counters", () => {
    render(<SiteFooter />)

    expect(
      screen.getByRole("link", { name: /privacy/i }).getAttribute("href")
    ).toBe("/privacy")
    expect(screen.getByText(/anonymous per-preset totals/i)).toBeTruthy()
    expect(screen.getByText(/no filenames, IPs, or cookies/i)).toBeTruthy()

    const stats = screen.getByRole("link", {
      name: /public per-preset usage stats json/i,
    })
    expect(stats.getAttribute("href")).toBe(usageStatsUrl())
    expect(stats.textContent).toBe("/stats")
  })
})
