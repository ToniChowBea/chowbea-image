import {
  HeadContent,
  Link,
  Scripts,
  createRootRoute,
  useRouter,
  useRouterState,
} from "@tanstack/react-router"
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools"
import { TanStackDevtools } from "@tanstack/react-devtools"
import { HugeiconsIcon } from "@hugeicons/react"
import { Image01Icon, GithubIcon } from "@hugeicons/core-free-icons"

import { FixTokenClaimer } from "@/components/fix/token-claimer"
import { JobsCounter } from "@/components/jobs-counter"
import { SiteFooter } from "@/components/site-footer"
import { resolveQueueToggle } from "@/lib/queue-toggle"
// Self-hosted latin faces — preloaded so the H1 is not blocked on Google Fonts.
import bricolageLatin from "@fontsource-variable/bricolage-grotesque/files/bricolage-grotesque-latin-wght-normal.woff2?url"
import hankenLatin from "@fontsource-variable/hanken-grotesk/files/hanken-grotesk-latin-wght-normal.woff2?url"
import appCss from "../styles.css?url"

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      {
        name: "description",
        content:
          "Bold, free image tools. Convert, compress, resize, rotate, crop, or fix a file to a UK portal's upload rules — no accounts, files deleted 1 hour after processing.",
      },
      { name: "theme-color", content: "#fff3e2" },
      { title: "Chowbea Image" },
    ],
    links: [
      {
        rel: "icon",
        href: "/favicon.svg",
        type: "image/svg+xml",
      },
      {
        rel: "preload",
        href: bricolageLatin,
        as: "font",
        type: "font/woff2",
        crossOrigin: "anonymous",
      },
      {
        rel: "preload",
        href: hankenLatin,
        as: "font",
        type: "font/woff2",
        crossOrigin: "anonymous",
      },
      { rel: "stylesheet", href: appCss },
    ],
  }),
  notFoundComponent: () => (
    <div className="flex flex-col items-center justify-center gap-4 py-32 text-center">
      <div className="font-heading text-7xl font-extrabold text-ink uppercase">
        404
      </div>
      <p className="text-lg font-medium text-subtext">
        That page wandered off.
      </p>
      <Link
        to="/"
        className="press inline-flex items-center gap-2 rounded-full border-2 border-ink bg-card px-5 py-2.5 text-sm font-extrabold tracking-wide text-ink uppercase shadow-block-sm"
      >
        Back to workspace
      </Link>
    </div>
  ),
  shellComponent: RootDocument,
})

/** Amber logo block + wordmark — the constant top-left mark on every screen. */
function Wordmark() {
  return (
    <Link to="/" className="flex min-w-0 items-center gap-3">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border-2 border-ink bg-amber text-ink">
        <HugeiconsIcon
          icon={Image01Icon}
          className="size-5"
          strokeWidth={2.4}
        />
      </span>
      <span className="font-heading text-lg font-extrabold tracking-tight text-ink sm:text-xl">
        Chowbea Image
      </span>
    </Link>
  )
}

// Where the user was before toggling to the queue; module scope so it
// survives re-renders without being page state.
let rememberedPath: string | null = null

/** The header Queue pill: navigates like a link but toggles back on the
second click. Middle-click / open-in-new-tab keep normal link behavior. */
function QueueLink() {
  const router = useRouter()
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })
  return (
    <Link
      to="/queue"
      onClick={(event) => {
        if (
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey ||
          event.button !== 0
        )
          return
        event.preventDefault()
        const { to, remember } = resolveQueueToggle(pathname, rememberedPath)
        rememberedPath = remember
        router.history.push(to)
      }}
      className="press inline-flex items-center gap-2 rounded-full border-2 border-ink bg-card px-5 py-2.5 text-sm font-extrabold tracking-wide text-ink uppercase shadow-block-sm"
    >
      Queue
    </Link>
  )
}

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <div className="min-h-svh bg-cream">
          <div className="mx-auto flex min-h-svh w-full max-w-7xl flex-col px-5 py-7 sm:px-8 sm:py-9 lg:px-10">
            {/* Top bar: wordmark left; jobs count, GitHub, and queue right. */}
            <header className="flex flex-wrap items-center justify-between gap-3">
              <Wordmark />
              <div className="flex items-center gap-3">
                <JobsCounter />
                <a
                  href="https://github.com/ToniChowBea/chowbea-image"
                  target="_blank"
                  rel="noreferrer"
                  aria-label="View the source and contribute on GitHub"
                  className="press flex size-[42px] items-center justify-center rounded-full border-2 border-ink bg-card text-ink shadow-block-sm"
                >
                  <HugeiconsIcon
                    icon={GithubIcon}
                    className="size-5"
                    strokeWidth={2.2}
                  />
                </a>
                <QueueLink />
              </div>
            </header>

            {/* Workspace pages wrap their own MotionConfig; the landing
            shell stays free of that runtime so first paint stays light. */}
            <FixTokenClaimer />
            <main className="flex-1">{children}</main>

            {/* Footer: brand, legal nav, and anonymous usage-counter note. */}
            <SiteFooter />
          </div>
        </div>

        {import.meta.env.DEV ? (
          <TanStackDevtools
            config={{ position: "bottom-right" }}
            plugins={[
              {
                name: "Tanstack Router",
                render: <TanStackRouterDevtoolsPanel />,
              },
            ]}
          />
        ) : null}
        <Scripts />
      </body>
    </html>
  )
}
