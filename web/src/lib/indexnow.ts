/**
 * IndexNow key and ping helpers. Bing and Yandex both speak the same JSON
 * protocol; we notify each host after a main deploy so new preset URLs land.
 */

import { publicSiteOrigin, sitemapPaths } from "./preset-seo"

/** Hosted at /{INDEXNOW_KEY}.txt — 8–128 letters, digits, or hyphens. */
export const INDEXNOW_KEY = "chowbea-img-indexnow-c7e41b8a"

/** Search engines the milestone asks us to ping. */
export const INDEXNOW_ENDPOINTS = [
  "https://www.bing.com/indexnow",
  "https://yandex.com/indexnow",
] as const

export interface IndexNowPayload {
  host: string
  key: string
  keyLocation: string
  urlList: string[]
}

export interface IndexNowResult {
  endpoint: string
  status: number
}

/** Absolute URL of the UTF-8 key file on this origin. */
export function indexNowKeyPath(): string {
  return `/${INDEXNOW_KEY}.txt`
}

/** JSON body for a bulk IndexNow POST of every sitemap URL. */
export function indexNowPayload(origin = publicSiteOrigin()): IndexNowPayload {
  const base = origin.replace(/\/$/, "")
  const host = new URL(base).host
  return {
    host,
    key: INDEXNOW_KEY,
    keyLocation: `${base}${indexNowKeyPath()}`,
    urlList: sitemapPaths().map((path) => `${base}${path}`),
  }
}

/**
 * Statuses that mean "accepted or already known". Repeating a deploy must
 * not look like a failure: 202 is first-time key verification, 422 means
 * the engine already has the URL, 429 is rate-limit backoff.
 */
export function isIndexNowOk(status: number): boolean {
  return (
    status === 200 ||
    status === 202 ||
    status === 204 ||
    status === 422 ||
    status === 429
  )
}

/** POST the sitemap URL list to Bing and Yandex. Never throws. */
export async function pingIndexNow(
  origin = publicSiteOrigin(),
  fetchImpl: typeof fetch = fetch
): Promise<IndexNowResult[]> {
  const payload = indexNowPayload(origin)
  const body = JSON.stringify(payload)
  const results: IndexNowResult[] = []
  for (const endpoint of INDEXNOW_ENDPOINTS) {
    try {
      const response = await fetchImpl(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body,
      })
      results.push({ endpoint, status: response.status })
    } catch {
      results.push({ endpoint, status: 0 })
    }
  }
  return results
}

/**
 * Exit 1 only when an engine rejects the key (400/403). Network blips and
 * "already submitted" responses are success so the job is safe to repeat.
 */
export function indexNowExitCode(results: IndexNowResult[]): number {
  const rejected = results.some(
    (result) => result.status === 400 || result.status === 403
  )
  return rejected ? 1 : 0
}
