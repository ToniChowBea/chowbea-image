import { createFileRoute } from "@tanstack/react-router"

import { publicSiteOrigin, sitemapXml } from "@/lib/preset-seo"

/** Machine-readable sitemap of every preset, /fix, and the privacy page. */
export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        // Use the configured public origin, not request.url — TLS is terminated
        // at Cloudflare/Railway, so the inbound protocol is http.
        return new Response(sitemapXml(publicSiteOrigin()), {
          headers: {
            "Content-Type": "application/xml; charset=utf-8",
            "Cache-Control": "public, max-age=3600",
          },
        })
      },
    },
  },
})
