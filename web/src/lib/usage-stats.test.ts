import { describe, expect, it } from "vitest"

import { API_BASE_URL } from "./jobs"
import { USAGE_STATS_PATH, usageStatsUrl } from "./usage-stats"

describe("usageStatsUrl", () => {
  it("points at the public /stats JSON path on the API host", () => {
    expect(USAGE_STATS_PATH).toBe("/stats")
    expect(usageStatsUrl()).toBe(`${API_BASE_URL.replace(/\/$/, "")}/stats`)
  })

  it("joins a custom API origin without a double slash", () => {
    expect(usageStatsUrl("https://api.example.test/")).toBe(
      "https://api.example.test/stats"
    )
  })
})
