import { defineConfig } from "vite"
import { devtools } from "@tanstack/devtools-vite"
import { tanstackStart } from "@tanstack/react-start/plugin/vite"
import viteReact from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import { nitro } from "nitro/vite"

const config = defineConfig({
  resolve: { tsconfigPaths: true },
  // nitro produces a self-contained Node server at .output/server/index.mjs for production.
  plugins: [
    ...(process.env.NODE_ENV === "development" ? [devtools()] : []),
    nitro({
      compressPublicAssets: true,
      plugins: ["server/plugins/gzip.ts"],
      routeRules: {
        "/assets/**": {
          headers: {
            "cache-control": "public, max-age=31536000, immutable",
          },
        },
        "/og/**": {
          headers: {
            "cache-control":
              "public, max-age=86400, stale-while-revalidate=604800",
          },
        },
        "/favicon.svg": {
          headers: {
            "cache-control": "public, max-age=86400",
          },
        },
        "/chowbea-img-indexnow-c7e41b8a.txt": {
          headers: {
            "cache-control": "public, max-age=86400",
          },
        },
      },
    }),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
  ],
})

export default config
