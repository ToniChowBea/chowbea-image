// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest"
import { cleanup, render, screen } from "@testing-library/react"

import { usageStatsUrl } from "@/lib/usage-stats"

import { UsageStatsLink, UsageStatsNote } from "./usage-stats-note"

afterEach(() => {
  cleanup()
})

describe("UsageStatsNote", () => {
  it("explains anonymous per-preset counters and links to public /stats JSON", () => {
    render(<UsageStatsNote />)

    expect(screen.getByText(/anonymous per-preset totals/i)).toBeTruthy()
    expect(screen.getByText(/no filenames, IPs, or cookies/i)).toBeTruthy()
    expect(screen.getByText(/public JSON/i)).toBeTruthy()

    const link = screen.getByRole("link", {
      name: /public per-preset usage stats json/i,
    })
    expect(link.getAttribute("href")).toBe(usageStatsUrl())
    expect(link.getAttribute("target")).toBe("_blank")
    expect(link.getAttribute("rel")).toBe("noreferrer")
    expect(link.textContent).toBe("/stats")
  })
})

describe("UsageStatsLink", () => {
  it("points at the same public JSON URL the privacy copy names", () => {
    render(<UsageStatsLink>/stats</UsageStatsLink>)
    const link = screen.getByRole("link", {
      name: /public per-preset usage stats json/i,
    })
    expect(link.getAttribute("href")).toBe(usageStatsUrl())
    expect(link.getAttribute("href")?.endsWith("/stats")).toBe(true)
  })
})
