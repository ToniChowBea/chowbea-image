import { API_BASE_URL } from "./jobs"

/** Public JSON path for anonymous per-preset usage aggregates. */
export const USAGE_STATS_PATH = "/stats"

/**
 * Absolute URL of GET /stats on the API host.
 * Aggregates only: no filenames, IPs, user agents, or cookies.
 */
export function usageStatsUrl(base = API_BASE_URL): string {
  return `${base.replace(/\/$/, "")}${USAGE_STATS_PATH}`
}
