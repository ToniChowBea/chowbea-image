import * as React from "react"

import { Button } from "@/components/ui/button"
import type { BillingConfig, CheckoutKind } from "@/lib/billing"
import { startCheckout } from "@/lib/billing"

/**
 * One-off Stripe Checkout for an evidence pack. Shown only when the paywall
 * is on and the user has picked more than one file.
 */
export function PaywallCard({
  config,
  onError,
}: {
  config: BillingConfig
  onError: (message: string) => void
}) {
  const [busy, setBusy] = React.useState<CheckoutKind | null>(null)

  async function pay(kind: CheckoutKind) {
    setBusy(kind)
    try {
      const url = await startCheckout(kind)
      window.location.assign(url)
    } catch (err) {
      onError(err instanceof Error ? err.message : "Could not start checkout.")
      setBusy(null)
    }
  }

  return (
    <div className="rounded-[16px] border-2 border-ink bg-soft-amber p-4 shadow-block-sm">
      <p className="font-heading text-sm font-extrabold tracking-wide text-ink uppercase">
        Evidence pack
      </p>
      <p className="mt-2 text-[13px] font-semibold text-ink">
        Single files stay free. A pack of several files is {config.batch_price} once, or{" "}
        {config.pass_price} for a 24-hour pass. Paid via Stripe — no account.
      </p>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <Button
          type="button"
          size="sm"
          disabled={busy !== null}
          onClick={() => void pay("batch")}
          className="bg-amber text-ink hover:bg-amber"
        >
          {busy === "batch" ? "Redirecting…" : `Pay ${config.batch_price} this pack`}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={busy !== null}
          onClick={() => void pay("pass")}
        >
          {busy === "pass" ? "Redirecting…" : `${config.pass_price} 24-hour pass`}
        </Button>
      </div>
    </div>
  )
}
