import { describe, expect, it, vi } from "vitest"

import { PRESET_IDS } from "./portal-catalogue"
import {
  INDEXNOW_ENDPOINTS,
  INDEXNOW_KEY,
  indexNowExitCode,
  indexNowKeyPath,
  indexNowPayload,
  isIndexNowOk,
  pingIndexNow,
} from "./indexnow"

describe("IndexNow", () => {
  it("hosts a valid key at the site root", () => {
    expect(INDEXNOW_KEY.length).toBeGreaterThanOrEqual(8)
    expect(INDEXNOW_KEY.length).toBeLessThanOrEqual(128)
    expect(INDEXNOW_KEY).toMatch(/^[A-Za-z0-9-]+$/)
    expect(indexNowKeyPath()).toBe(`/${INDEXNOW_KEY}.txt`)
  })

  it("submits every sitemap URL to Bing and Yandex", () => {
    const payload = indexNowPayload("https://img.chowbea.com")
    expect(payload.host).toBe("img.chowbea.com")
    expect(payload.key).toBe(INDEXNOW_KEY)
    expect(payload.keyLocation).toBe(
      `https://img.chowbea.com/${INDEXNOW_KEY}.txt`
    )
    expect(payload.urlList).toContain("https://img.chowbea.com/")
    expect(payload.urlList).toContain("https://img.chowbea.com/portals")
    for (const id of PRESET_IDS) {
      expect(payload.urlList).toContain(`https://img.chowbea.com/fix/${id}`)
    }
    expect(INDEXNOW_ENDPOINTS).toEqual([
      "https://www.bing.com/indexnow",
      "https://yandex.com/indexnow",
    ])
  })

  it("treats repeat submissions as success", () => {
    expect(isIndexNowOk(200)).toBe(true)
    expect(isIndexNowOk(202)).toBe(true)
    expect(isIndexNowOk(422)).toBe(true)
    expect(isIndexNowOk(429)).toBe(true)
    expect(isIndexNowOk(403)).toBe(false)
    expect(
      indexNowExitCode([
        { endpoint: INDEXNOW_ENDPOINTS[0], status: 202 },
        { endpoint: INDEXNOW_ENDPOINTS[1], status: 422 },
      ])
    ).toBe(0)
    expect(
      indexNowExitCode([{ endpoint: INDEXNOW_ENDPOINTS[0], status: 403 }])
    ).toBe(1)
  })

  it("pings both engines with the same payload and survives network errors", async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      if (String(url).includes("bing")) {
        return new Response(null, { status: 202 })
      }
      throw new Error("offline")
    }) as unknown as typeof fetch
    const results = await pingIndexNow("https://img.chowbea.com", fetchImpl)
    expect(results).toEqual([
      { endpoint: "https://www.bing.com/indexnow", status: 202 },
      { endpoint: "https://yandex.com/indexnow", status: 0 },
    ])
    expect(indexNowExitCode(results)).toBe(0)
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })
})
