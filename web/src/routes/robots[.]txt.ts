import { createFileRoute } from "@tanstack/react-router"

import { robotsTxt } from "@/lib/preset-seo"

/** Points crawlers at /sitemap.xml using this request's origin. */
export const Route = createFileRoute("/robots.txt")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const origin = new URL(request.url).origin
        return new Response(robotsTxt(origin), {
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "public, max-age=3600",
          },
        })
      },
    },
  },
})
