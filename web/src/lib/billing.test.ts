/** @vitest-environment jsdom */

import axios from "axios"
import { afterEach, describe, expect, it, vi } from "vitest"

import {
  claimSession,
  clearFixToken,
  fetchBillingConfig,
  getFixToken,
  setFixToken,
  startCheckout,
} from "./billing"

describe("fix token localStorage", () => {
  afterEach(() => {
    clearFixToken()
  })

  it("round-trips a token", () => {
    expect(getFixToken()).toBeNull()
    setFixToken("pass.abc.1.sig")
    expect(getFixToken()).toBe("pass.abc.1.sig")
    clearFixToken()
    expect(getFixToken()).toBeNull()
  })
})

describe("billing API wrappers", () => {
  afterEach(() => vi.restoreAllMocks())

  it("fetches paywall config", async () => {
    vi.spyOn(axios, "get").mockResolvedValue({
      data: { paywall: false, batch_price: "£1.99", pass_price: "£4.99", currency: "gbp" },
    })
    const config = await fetchBillingConfig()
    expect(config.paywall).toBe(false)
    expect(vi.mocked(axios.get).mock.calls[0]?.[0]).toBe("http://localhost:8000/billing/config")
  })

  it("starts checkout and returns the Stripe URL", async () => {
    vi.spyOn(axios, "post").mockResolvedValue({
      data: { url: "https://checkout.stripe.com/c/pay/cs_test" },
    })
    const url = await startCheckout("batch")
    expect(url).toContain("checkout.stripe.com")
    expect(vi.mocked(axios.post).mock.calls[0]?.[0]).toBe("http://localhost:8000/billing/checkout")
    expect(vi.mocked(axios.post).mock.calls[0]?.[1]).toEqual({ kind: "batch" })
  })

  it("claims a session id for a localStorage token", async () => {
    vi.spyOn(axios, "post").mockResolvedValue({
      data: { token: "batch.jti.1.sig", kind: "batch", expires_at: 1 },
    })
    const claimed = await claimSession("cs_test")
    expect(claimed.token).toBe("batch.jti.1.sig")
    expect(vi.mocked(axios.post).mock.calls[0]?.[1]).toEqual({ session_id: "cs_test" })
  })
})
