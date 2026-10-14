import { AnimatePresence, motion } from "motion/react"

import {
  Progress,
  ProgressLabel,
  ProgressValue,
} from "@/components/ui/progress"
import type { JobProgress } from "@/lib/jobs"
import { useWorkspace } from "@/stores/workspace"

const FADE = {
  initial: { opacity: 0, y: 4 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -4 },
  transition: { duration: 0.15, ease: [0.22, 1, 0.36, 1] as const },
}

/** One-line label per phase — the only place "position N of M" text lives. */
function phaseLabel(progress: JobProgress): string {
  switch (progress.phase) {
    case "uploading":
      return "Uploading…"
    case "downloading":
      return "Downloading…"
    case "processing":
      return "Processing…"
    case "queued":
      return progress.position && progress.queueSize
        ? `Queued — position ${progress.position} of ${progress.queueSize}`
        : "Queued in line…"
  }
}

/** The Bold Blocks indeterminate track: a quarter-width amber block sliding
through an ink-outlined rail (`.animate-indeterminate`, defined once in
styles.css) — used whenever a phase has no measurable percent. */
function IndeterminateTrack() {
  return (
    <div className="relative flex h-2.5 w-full items-center overflow-x-hidden rounded-full border-2 border-ink bg-surface">
      <div className="animate-indeterminate absolute inset-y-0 left-0 w-1/4 rounded-full bg-amber" />
    </div>
  )
}

/**
 * Live status row pinned under the workspace: idle copy until a job starts,
 * then a phase-appropriate treatment — a real percent bar for
 * uploading/downloading, an indeterminate Bold Blocks slide for
 * queued/processing. Error states are surfaced next to the Go button
 * instead (see `GoBar`), not duplicated here. Pass `progress` / `idleLabel`
 * to reuse the row outside the workspace store.
 */
export function ProgressRow({
  progress: progressProp,
  idleLabel,
}: {
  progress?: JobProgress | null
  idleLabel?: string
} = {}) {
  const storeProgress = useWorkspace((state) => state.progress)
  const progress = progressProp !== undefined ? progressProp : storeProgress

  return (
    <div role="status" aria-live="polite" className="block-card">
      <AnimatePresence mode="wait" initial={false}>
        {progress ? (
          <motion.div key={progress.phase} {...FADE}>
            {progress.percent !== null ? (
              <Progress value={progress.percent}>
                <div className="flex w-full items-center justify-between">
                  <ProgressLabel>{phaseLabel(progress)}</ProgressLabel>
                  <ProgressValue />
                </div>
              </Progress>
            ) : (
              // Base UI's ProgressLabel/ProgressValue need a <Progress> (Root)
              // ancestor for context — indeterminate phases skip that
              // primitive entirely, so this is a plain <p> matching its
              // styling instead of the compound component.
              <div className="flex w-full flex-col gap-2">
                <p className="font-heading text-sm font-bold text-ink">
                  {phaseLabel(progress)}
                </p>
                {progress.phase === "processing" ? (
                  <IndeterminateTrack />
                ) : (
                  <div className="h-2.5 w-full rounded-full border-2 border-dashed border-line" />
                )}
              </div>
            )}
          </motion.div>
        ) : (
          <motion.p
            key="idle"
            {...FADE}
            className="text-[13px] font-semibold text-muted-ink"
          >
            {idleLabel ??
              "Nothing running yet — pick a tool, set your options, and go."}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  )
}
