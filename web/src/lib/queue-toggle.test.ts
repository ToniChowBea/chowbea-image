import { describe, expect, it } from "vitest"

import { resolveQueueToggle } from "./queue-toggle"

describe("resolveQueueToggle", () => {
  it("navigates to the queue and remembers where you were", () => {
    expect(resolveQueueToggle("/", null)).toEqual({ to: "/queue", remember: "/" })
  })

  it("returns to the remembered location from the queue", () => {
    expect(resolveQueueToggle("/queue", "/")).toEqual({ to: "/", remember: "/" })
  })

  it("falls back to home when the queue was the entry point", () => {
    expect(resolveQueueToggle("/queue", null)).toEqual({ to: "/", remember: null })
  })
})
