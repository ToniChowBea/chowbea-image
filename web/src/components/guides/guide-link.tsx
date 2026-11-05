import { Link } from "@tanstack/react-router"

import { isGuideSlug } from "@/lib/guides"

/**
 * Deep link from a /fix/<preset> page to the matching how-to guide.
 * Hidden when that preset has no guide.
 */
export function GuideLink({ presetId }: { presetId: string }) {
  if (!isGuideSlug(presetId)) return null
  return (
    <p className="mt-2">
      <Link
        to="/guides/$slug"
        params={{ slug: presetId }}
        className="text-[13px] font-extrabold text-ink underline decoration-2 underline-offset-2"
      >
        Need help? Read the guide
      </Link>
    </p>
  )
}
