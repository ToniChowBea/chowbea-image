import { createFileRoute } from "@tanstack/react-router"

import { publicSiteOrigin, robotsTxt } from "@/lib/preset-seo"

/** Points crawlers at /sitemap.xml on the public https origin. */
export const Route = createFileRoute("/robots.txt")({
  server: {
    handlers: {
      GET: async () => {
        // Use the configured public origin, not request.url — TLS is terminated
        // at Cloudflare/Railway, so the inbound protocol is http.
        return new Response(robotsTxt(publicSiteOrigin()), {
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "public, max-age=3600",
          },
        })
      },
    },
  },
})
