/**
 * Emits a JSON-LD <script> for crawlers. `payload` is already a plain object.
 */
export function JsonLd({ payload }: { payload: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(payload) }}
    />
  )
}
