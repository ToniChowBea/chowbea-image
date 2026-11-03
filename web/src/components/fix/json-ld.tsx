/**
 * Emits a JSON-LD <script> for crawlers. `payload` is already a plain object.
 * `<` is escaped so the browser never reads the JSON as HTML.
 */
export function JsonLd({ payload }: { payload: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(payload).replace(/</g, "\\u003c"),
      }}
    />
  )
}
