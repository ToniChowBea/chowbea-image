import * as React from "react"

import { fetchQueueBoard } from "@/lib/jobs"

/** Ease-out count-up without pulling the Motion runtime into every page. */
function tweenTo(
  target: number,
  onFrame: (value: number) => void,
  durationMs = 800
): () => void {
  const start = performance.now()
  let frame = 0
  const tick = (now: number) => {
    const t = Math.min(1, (now - start) / durationMs)
    const eased = 1 - (1 - t) * (1 - t)
    onFrame(Math.round(eased * target))
    if (t < 1) frame = requestAnimationFrame(tick)
  }
  frame = requestAnimationFrame(tick)
  return () => cancelAnimationFrame(frame)
}

/** Lifetime jobs-performed chip for the header. Renders nothing until the
count arrives and never shows zero — the site shouldn't advertise "0 jobs
done". Hidden on small screens where the header has no room for it. */
export function JobsCounter() {
  const [count, setCount] = React.useState<number | null>(null)
  const [display, setDisplay] = React.useState(0)

  React.useEffect(() => {
    let cancelled = false
    fetchQueueBoard()
      .then((board) => {
        if (!cancelled && typeof board.jobs_completed === "number") {
          setCount(board.jobs_completed)
        }
      })
      .catch(() => {
        // Show nothing rather than an error state.
      })
    return () => {
      cancelled = true
    }
  }, [])

  React.useEffect(() => {
    if (count === null || count === 0) return
    return tweenTo(count, setDisplay)
  }, [count])

  if (count === null || count === 0) return null
  return (
    <span className="hidden items-center gap-2 rounded-full border-2 border-ink bg-amber px-4 py-2.5 text-[13px] font-extrabold tracking-wide text-ink uppercase shadow-block-sm sm:inline-flex">
      <span className="tabular-nums">{display.toLocaleString()}</span> jobs done
    </span>
  )
}
