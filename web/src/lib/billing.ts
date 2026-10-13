/**
 * Payment tokens for evidence packs. No accounts — Stripe Checkout mints a
 * signed token that lives in localStorage until it expires or is used.
 */

import axios from "axios"

import { capture } from "./analytics"
import { API_BASE_URL, toApiError } from "./jobs"

const TOKEN_KEY = "chowbea:fix-token"

export type CheckoutKind = "batch" | "pass"

export interface BillingConfig {
  paywall: boolean
  batch_price: string
  pass_price: string
  currency: string
}

export interface ClaimedToken {
  token: string
  kind: CheckoutKind
  expires_at: number
}

export interface Entitlement {
  valid: boolean
  kind: CheckoutKind | null
  expires_at: number | null
  detail: string | null
}

/** Read the stored entitlement token, if any. */
export function getFixToken(): string | null {
  if (typeof window === "undefined") return null
  try {
    return window.localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

/** Persist a token from Checkout claim. */
export function setFixToken(token: string): void {
  if (typeof window === "undefined") return
  window.localStorage.setItem(TOKEN_KEY, token)
}

/** Drop a used or invalid token. */
export function clearFixToken(): void {
  if (typeof window === "undefined") return
  window.localStorage.removeItem(TOKEN_KEY)
}

/** Whether the batch paywall is on, plus the displayed prices. */
export async function fetchBillingConfig(): Promise<BillingConfig> {
  const response = await axios.get<BillingConfig>(`${API_BASE_URL}/billing/config`)
  return response.data
}

/** Redirect the browser to Stripe Checkout for a one-off payment. */
export async function startCheckout(kind: CheckoutKind): Promise<string> {
  capture("checkout_started", { kind })
  try {
    const response = await axios.post<{ url: string }>(`${API_BASE_URL}/billing/checkout`, { kind })
    return response.data.url
  } catch (err) {
    throw await toApiError(err)
  }
}

/** Exchange a Checkout session id for a localStorage token. */
export async function claimSession(sessionId: string): Promise<ClaimedToken> {
  try {
    const response = await axios.post<ClaimedToken>(`${API_BASE_URL}/billing/claim`, {
      session_id: sessionId,
    })
    capture("checkout_completed", { kind: response.data.kind })
    return response.data
  } catch (err) {
    throw await toApiError(err)
  }
}

/** Ask the API whether a stored token still works. */
export async function fetchEntitlement(token: string): Promise<Entitlement> {
  const response = await axios.get<Entitlement>(`${API_BASE_URL}/billing/entitlement`, {
    params: { token },
  })
  return response.data
}
