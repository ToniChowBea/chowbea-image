import { createFileRoute } from "@tanstack/react-router"

import { INDEXNOW_KEY } from "@/lib/indexnow"

/** IndexNow ownership file: the filename is the key, the body is the key. */
export const Route = createFileRoute("/chowbea-img-indexnow-c7e41b8a.txt")({
  server: {
    handlers: {
      GET: async () => {
        return new Response(INDEXNOW_KEY, {
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "public, max-age=86400",
          },
        })
      },
    },
  },
})
