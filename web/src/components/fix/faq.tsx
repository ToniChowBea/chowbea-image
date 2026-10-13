import type { FaqItem } from "@/lib/preset-seo"

/** Short accordion-looking FAQ used on preset pages. */
export function PresetFaq({ items }: { items: FaqItem[] }) {
  if (items.length === 0) return null
  return (
    <section className="block-card">
      <h2 className="mb-3 font-heading text-sm font-extrabold tracking-wide text-ink uppercase">
        FAQ
      </h2>
      <dl className="flex flex-col gap-3">
        {items.map((item) => (
          <div key={item.q}>
            <dt className="text-[13px] font-extrabold text-ink">{item.q}</dt>
            <dd className="mt-1 text-[13px] font-medium text-subtext">
              {item.a}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
