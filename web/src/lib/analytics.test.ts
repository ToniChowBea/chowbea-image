import { afterEach, describe, expect, it, vi } from "vitest"

import { capture } from "./analytics"

describe("optional PostHog capture", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it("is a no-op when the key is missing", () => {
    vi.stubEnv("VITE_PUBLIC_POSTHOG_KEY", "")
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)
    capture("fix_started", { preset: "ucas-documents" })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("posts preset and file type, never a filename", () => {
    vi.stubEnv("VITE_PUBLIC_POSTHOG_KEY", "phc_test")
    vi.stubEnv("VITE_PUBLIC_POSTHOG_HOST", "https://example.test")
    const fetchMock = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal("fetch", fetchMock)
    capture("fix_succeeded", {
      preset: "ukvcas",
      file_type: "pdf",
      filename: "secret.pdf",
    })
    expect(fetchMock).toHaveBeenCalledOnce()
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe("https://example.test/capture/")
    const payload = JSON.parse(String(init.body)) as {
      event: string
      distinct_id: string
      properties: Record<string, unknown>
    }
    expect(payload.event).toBe("fix_succeeded")
    expect(payload.distinct_id).toBe("anonymous")
    expect(payload.properties.preset).toBe("ukvcas")
    expect(payload.properties.file_type).toBe("pdf")
    expect(payload.properties.filename).toBeUndefined()
  })
})
