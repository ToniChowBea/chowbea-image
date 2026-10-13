import type { FileReport, FixReport } from "@/lib/jobs"
import { cn } from "@/lib/utils"

/**
 * Per-file pass/fail list for a finished fix job. Shows the actual value
 * next to the expected rule so the user can see why a portal might still
 * reject the file.
 */
export function FixReportCard({ report }: { report: FixReport }) {
  return (
    <div className="block-card">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="font-heading text-sm font-extrabold tracking-wide text-ink uppercase">
          Rule check
        </p>
        <span
          className={cn(
            "rounded-full border-2 border-ink px-3 py-0.5 font-heading text-xs font-extrabold uppercase",
            report.passed
              ? "bg-amber text-ink"
              : "bg-destructive text-destructive-foreground"
          )}
        >
          {report.passed ? "All passed" : "Needs review"}
        </span>
      </div>
      <div className="flex flex-col gap-4">
        {report.files.map((file) => (
          <FileRules key={file.filename} file={file} />
        ))}
      </div>
    </div>
  )
}

function FileRules({ file }: { file: FileReport }) {
  return (
    <div>
      <p
        className="mb-2 truncate text-[12px] font-bold text-muted-ink"
        title={file.filename}
      >
        {file.filename}
      </p>
      <ul className="flex flex-col gap-1.5">
        {file.rules.map((rule) => (
          <li key={rule.id} className="flex items-start gap-2 text-[13px]">
            <span
              className={cn(
                "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border-2 border-ink font-heading text-[11px] font-extrabold",
                rule.passed
                  ? "bg-amber text-ink"
                  : "bg-destructive text-destructive-foreground"
              )}
              aria-label={rule.passed ? "Passed" : "Failed"}
            >
              {rule.passed ? "P" : "F"}
            </span>
            <span className="min-w-0">
              <span className="font-bold text-ink">{rule.label}</span>
              <span className="text-muted-ink">
                {" "}
                — {rule.actual}
                <span className="text-muted-ink/80">
                  {" "}
                  (need {rule.expected})
                </span>
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
