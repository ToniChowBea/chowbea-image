/**
 * Optional, privacy-friendly PostHog capture.
 *
 * Off when VITE_PUBLIC_POSTHOG_KEY is missing. Events never include file
 * names or contents — only preset ids, MIME/file types, and counts.
 * No cookies: distinct_id stays the literal "anonymous".
 */

const EVENT_NAMES = [
  "fix_started",
  "fix_succeeded",
  "fix_failed",
  "checkout_started",
  "checkout_completed",
] as const

export type AnalyticsEvent = (typeof EVENT_NAMES)[number]

export type AnalyticsProps = Record<string, string | number | boolean | undefined>

/** Project API key, empty when analytics is off. */
export function posthogKey(): string {
  const key = import.meta.env.VITE_PUBLIC_POSTHOG_KEY
  return typeof key === "string" ? key.trim() : ""
}

/** Capture host; defaults to the US PostHog cloud. */
export function posthogHost(): string {
  const host = import.meta.env.VITE_PUBLIC_POSTHOG_HOST
  if (typeof host === "string" && host.trim()) return host.replace(/\/$/, "")
  return "https://us.i.posthog.com"
}

const BLOCKED = new Set(["filename", "name", "path", "bytes", "file", "content"])

/** Send one named event. No-op when the key is unset. Never throws. */
export function capture(event: AnalyticsEvent, properties: AnalyticsProps = {}): void {
  const key = posthogKey()
  if (!key) return
  const clean: Record<string, string | number | boolean> = {}
  for (const [name, value] of Object.entries(properties)) {
    if (value === undefined || BLOCKED.has(name)) continue
    clean[name] = value
  }
  const body = JSON.stringify({
    api_key: key,
    event,
    distinct_id: "anonymous",
    properties: { ...clean, $process_person_profile: false },
  })
  void fetch(`${posthogHost()}/capture/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => {
    // Analytics must never break the fixer.
  })
}
