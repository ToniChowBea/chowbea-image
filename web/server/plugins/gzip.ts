/**
 * Gzip HTML/JSON/JS/CSS responses when the client asks for it.
 * Precompressed public assets already set Content-Encoding and are skipped.
 */

import { gzipSync } from "node:zlib"

import { definePlugin } from "nitro"

const COMPRESSIBLE =
  /^(text\/|application\/(javascript|json|xml|ld\+json)|image\/svg\+xml)/i

export default definePlugin((nitro) => {
  const originalFetch = nitro.fetch.bind(nitro)
  nitro.fetch = async (request) => {
    const response = await originalFetch(request)
    const accept = request.headers.get("accept-encoding") ?? ""
    if (!accept.includes("gzip")) return response
    if (response.headers.get("content-encoding")) return response
    const type = response.headers.get("content-type") ?? ""
    if (!COMPRESSIBLE.test(type)) return response
    const bytes = Buffer.from(await response.arrayBuffer())
    if (bytes.byteLength < 1024) {
      return new Response(bytes, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      })
    }
    const gzipped = gzipSync(bytes)
    const headers = new Headers(response.headers)
    headers.set("Content-Encoding", "gzip")
    headers.set("Content-Length", String(gzipped.byteLength))
    headers.append("Vary", "Accept-Encoding")
    return new Response(gzipped, {
      status: response.status,
      statusText: response.statusText,
      headers,
    })
  }
})
