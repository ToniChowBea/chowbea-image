import { createFileRoute, Link } from "@tanstack/react-router"

import { PRIVACY_SEO, pageSeoHead } from "@/lib/preset-seo"

export const Route = createFileRoute("/privacy")({
  head: () =>
    pageSeoHead(PRIVACY_SEO.title, PRIVACY_SEO.description, "/privacy"),
  component: PrivacyPage,
})

/** How long files live, and what we never log. */
function PrivacyPage() {
  return (
    <article className="mx-auto max-w-2xl pb-12">
      <h1 className="mt-8 font-heading text-3xl font-extrabold tracking-tight text-ink uppercase sm:text-[44px]">
        {PRIVACY_SEO.h1}
      </h1>
      <p className="mt-4 text-[15px] font-semibold text-subtext">
        Chowbea Image is a no-signup toolkit. This page covers the upload fixer
        and the rest of the image tools.
      </p>

      <section className="mt-8">
        <h2 className="font-heading text-lg font-extrabold text-ink">
          Files are deleted after 1 hour
        </h2>
        <p className="mt-2 text-[15px] font-medium text-ink">
          Every upload is written to a short-lived workspace on the server. One
          hour after a job finishes (or one hour after an abandoned upload was
          created) the workspace is removed from disk. Finished downloads stop
          working once that hour is up.
        </p>
      </section>

      <section className="mt-6">
        <h2 className="font-heading text-lg font-extrabold text-ink">
          We never log file contents
        </h2>
        <p className="mt-2 text-[15px] font-medium text-ink">
          Logs record generic errors and job ids — not filenames, not image
          bytes, not PDF text. Passport and visa photos are treated as
          sensitive. Encode steps do not stamp attribution onto fixer outputs.
        </p>
      </section>

      <section className="mt-6">
        <h2 className="font-heading text-lg font-extrabold text-ink">
          No accounts
        </h2>
        <p className="mt-2 text-[15px] font-medium text-ink">
          Single-file fixes are free and do not require a login. When payments
          are configured, an evidence pack is a Stripe Checkout one-off. Stripe
          handles the card; we store a signed token in your browser&apos;s
          localStorage (one-time or 24 hours), not an account on our side.
        </p>
      </section>

      <section className="mt-6">
        <h2 className="font-heading text-lg font-extrabold text-ink">
          Optional analytics
        </h2>
        <p className="mt-2 text-[15px] font-medium text-ink">
          When a PostHog project key is configured, we send a few product
          events: fix started, succeeded or failed (preset id and file type
          only), and checkout started or completed. Analytics is off when that
          key is missing. We never send file names or file contents, and we do
          not store a cookie or a personal profile for this.
        </p>
      </section>

      <section className="mt-6">
        <h2 className="font-heading text-lg font-extrabold text-ink">
          What stays in your browser
        </h2>
        <p className="mt-2 text-[15px] font-medium text-ink">
          localStorage remembers recent job ids so the queue board can highlight
          yours, and it holds a payment token if you bought a pack. You can
          clear site data in the browser to drop both.
        </p>
      </section>

      <p className="mt-10 text-[13px] font-semibold text-muted-ink">
        Questions about a portal&apos;s own rules belong on that portal. This
        tool only fixes format, size and pixels.{" "}
        <Link to="/fix" className="underline decoration-2 underline-offset-2">
          Back to the upload fixer
        </Link>
        .
      </p>
    </article>
  )
}
