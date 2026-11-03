/**
 * Notify Bing and Yandex that the sitemap URLs changed.
 * Safe to run on every deploy to main: already-known URLs are not errors.
 * Retries 403/network so a ping that races Railway still succeeds.
 *
 *   bun scripts/ping-indexnow.ts
 *   INDEXNOW_ORIGIN=https://img.chowbea.com bun scripts/ping-indexnow.ts
 */

import {
  INDEXNOW_KEY,
  indexNowExitCode,
  indexNowPayload,
  isIndexNowOk,
  pingIndexNow,
  type IndexNowResult,
} from "../src/lib/indexnow"

const origin = (
  process.env.INDEXNOW_ORIGIN || "https://img.chowbea.com"
).replace(/\/$/, "")

const retries = Math.max(1, Number(process.env.INDEXNOW_RETRIES || 6))
const delayMs = Math.max(0, Number(process.env.INDEXNOW_RETRY_MS || 10_000))

const payload = indexNowPayload(origin)
console.log(
  `IndexNow: ${payload.urlList.length} URLs, key ${INDEXNOW_KEY}, origin ${origin}`
)

function shouldRetry(results: IndexNowResult[]): boolean {
  return results.some((result) => result.status === 0 || result.status === 403)
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

let results: IndexNowResult[] = []
for (let attempt = 1; attempt <= retries; attempt++) {
  results = await pingIndexNow(origin)
  for (const result of results) {
    const label = isIndexNowOk(result.status) ? "ok" : "warn"
    console.log(
      `  ${label} ${result.endpoint} → ${result.status || "network"} (try ${attempt}/${retries})`
    )
  }
  if (!shouldRetry(results)) {
    break
  }
  if (attempt < retries && delayMs > 0) {
    await sleep(delayMs)
  }
}

process.exit(indexNowExitCode(results))
