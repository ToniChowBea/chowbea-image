import { createFileRoute } from "@tanstack/react-router"

import { sitemapXml } from "@/lib/preset-seo"

/** Machine-readable sitemap of every preset, /fix, and the privacy page. */
export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const origin = new URL(request.url).origin
        return new Response(sitemapXml(origin), {
          headers: {
            "Content-Type": "application/xml; charset=utf-8",
            "Cache-Control": "public, max-age=3600",
          },
        })
      },
    },
  },
})
