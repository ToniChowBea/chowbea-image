// @vitest-environment jsdom
import type { ReactNode } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, render, screen } from "@testing-library/react"

import { usageStatsUrl } from "@/lib/usage-stats"

import { PrivacyPage } from "./privacy-page"

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

describe("PrivacyPage", () => {
  it("explains anonymous per-preset counters and links to public /stats JSON", () => {
    render(<PrivacyPage />)

    expect(
      screen.getByRole("heading", { name: /anonymous usage counts/i })
    ).toBeTruthy()
    expect(
      screen.getByText(/no filenames, IPs, user agents, or cookies/i)
    ).toBeTruthy()
    expect(screen.getByText(/JSON endpoint/i)).toBeTruthy()

    const stats = screen.getByRole("link", {
      name: /public per-preset usage stats json/i,
    })
    expect(stats.getAttribute("href")).toBe(usageStatsUrl())
    expect(stats.textContent).toBe("/stats")
  })
})
