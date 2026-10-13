import * as React from "react"

import { claimSession, setFixToken } from "@/lib/billing"

/**
 * After Stripe Checkout, the success URL lands with `?session_id=…`.
 * Claim the signed token and stash it in localStorage, then drop the query.
 */
export function FixTokenClaimer() {
  React.useEffect(() => {
    if (typeof window === "undefined") return
    const params = new URLSearchParams(window.location.search)
    const sessionId = params.get("session_id")
    if (!sessionId) return
    let cancelled = false
    claimSession(sessionId)
      .then((claimed) => {
        if (cancelled) return
        setFixToken(claimed.token)
        params.delete("session_id")
        const next = `${window.location.pathname}${params.toString() ? `?${params}` : ""}${window.location.hash}`
        window.history.replaceState({}, "", next)
      })
      .catch(() => {
        // Leave the query in place so the user can retry; the fix page shows errors.
      })
    return () => {
      cancelled = true
    }
  }, [])
  return null
}
