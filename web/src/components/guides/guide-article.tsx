import { Link } from "@tanstack/react-router"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowLeft01Icon, ArrowRight02Icon } from "@hugeicons/core-free-icons"

import { JsonLd } from "@/components/fix/json-ld"
import { PresetFaq } from "@/components/fix/faq"
import { Badge } from "@/components/ui/badge"
import type { Guide } from "@/lib/guides"
import { guideSteps } from "@/lib/guides"
import { guideBreadcrumbJsonLd } from "@/lib/json-ld"
import { faqJsonLd } from "@/lib/preset-seo"

/**
 * Crawlable how-to body: official limit, source, steps, CTA into /fix, FAQ
 * and JSON-LD. Used by /guides/$slug.
 */
export function GuideArticle({ guide }: { guide: Guide }) {
  const steps = guideSteps(guide.slug)
  const faq = [...guide.faq]

  return (
    <article className="page-stack pb-10">
      <JsonLd payload={faqJsonLd(faq)} />
      <JsonLd payload={guideBreadcrumbJsonLd(guide.slug)} />

      <nav aria-label="Breadcrumb" className="flex flex-wrap gap-2">
        <Link
          to="/guides"
          className="press inline-flex w-fit items-center gap-2 rounded-full border-2 border-ink bg-card px-4 py-2 text-[13px] font-extrabold tracking-wide text-ink uppercase shadow-block-sm"
        >
          <HugeiconsIcon
            icon={ArrowLeft01Icon}
            className="size-3.5"
            strokeWidth={2.6}
          />
          All guides
        </Link>
        <Link
          to="/portals"
          className="press inline-flex w-fit items-center gap-2 rounded-full border-2 border-ink bg-card px-4 py-2 text-[13px] font-extrabold tracking-wide text-ink uppercase shadow-block-sm"
        >
          UK portals
        </Link>
      </nav>

      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-heading text-3xl leading-none font-extrabold tracking-tight text-ink uppercase sm:text-[44px]">
            {guide.h1}
          </h1>
          <Badge variant={guide.verified ? "amber" : "outline"}>
            {guide.verified ? "Verified" : "Unverified"}
          </Badge>
        </div>
        <p className="max-w-2xl text-[15px] font-semibold text-subtext">
          {guide.intro}
        </p>
        <p className="text-[13px] font-semibold text-muted-ink">
          Rules last checked {guide.lastChecked}
        </p>
      </header>

      <section className="block-card">
        <h2 className="mb-3 font-heading text-sm font-extrabold tracking-wide text-ink uppercase">
          Official limit
        </h2>
        <ul className="flex flex-col gap-1.5 text-[13px] font-semibold text-ink">
          <li>Size: {guide.limit}</li>
          <li>Formats: {guide.formats}</li>
          {guide.extras.map((extra) => (
            <li key={extra}>{extra}</li>
          ))}
        </ul>
        <a
          href={guide.sourceUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-extrabold text-ink underline decoration-2 underline-offset-2"
        >
          {guide.sourceLabel} ↗
        </a>
      </section>

      <section className="block-card">
        <h2 className="mb-3 font-heading text-sm font-extrabold tracking-wide text-ink uppercase">
          How to fix your file
        </h2>
        <ol className="flex flex-col gap-2">
          {steps.map((step, index) => (
            <li
              key={step}
              className="flex gap-3 text-[13px] font-semibold text-ink"
            >
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full border-2 border-ink bg-amber font-heading text-[12px] font-extrabold">
                {index + 1}
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
        <Link
          to="/fix/$preset"
          params={{ preset: guide.presetId }}
          className="press mt-5 inline-flex w-fit items-center gap-2.5 rounded-full border-2 border-ink bg-amber px-6 py-3.5 font-heading text-base font-extrabold tracking-wide text-ink uppercase shadow-block"
        >
          {guide.ctaLabel}
          <HugeiconsIcon
            icon={ArrowRight02Icon}
            className="size-5"
            strokeWidth={2.4}
          />
        </Link>
      </section>

      <p className="rounded-[20px] border-2 border-ink bg-soft-amber px-5 py-4 text-[13px] font-semibold text-ink">
        This tool only fixes file format, size and pixels. It does not check
        faces, backgrounds or content, and it does not guarantee a portal will
        accept the file.
      </p>

      <PresetFaq items={faq} />
    </article>
  )
}
