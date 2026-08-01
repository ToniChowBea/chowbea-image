// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, render, screen } from "@testing-library/react"

import { useWorkspace } from "@/stores/workspace"

import { GoBar } from "./go-bar"

beforeEach(() => {
  global.URL.createObjectURL = vi.fn(() => "blob:mock-url") as any
  global.URL.revokeObjectURL = vi.fn() as any
})

afterEach(() => {
  cleanup()
  useWorkspace.setState({ images: [], selectedIds: new Set(), activeTool: null, submitting: false })
})

describe("GoBar", () => {
  it("disables Go with 0 images selected", () => {
    render(<GoBar />)

    expect(screen.getByText("0 images selected")).toBeTruthy()
    expect(screen.getByRole("button", { name: /go/i }).hasAttribute("disabled")).toBe(true)
  })

  it("enables Go once an image is selected", () => {
    const file = new File(["a"], "photo.png", { type: "image/png" })
    useWorkspace.getState().addFiles([file])
    useWorkspace.getState().setActiveTool("convert")

    render(<GoBar />)

    expect(screen.getByText("1 image selected")).toBeTruthy()
    expect(screen.getByRole("button", { name: /go/i }).hasAttribute("disabled")).toBe(false)
  })

  it("disables Go while submitting, even across a remount (tool-switch crossfade)", () => {
    const file = new File(["a"], "photo.png", { type: "image/png" })
    useWorkspace.getState().addFiles([file])
    useWorkspace.getState().setActiveTool("convert")
    useWorkspace.getState().setSubmitting(true)

    const { unmount } = render(<GoBar />)
    expect(screen.getByRole("button", { name: /working/i }).hasAttribute("disabled")).toBe(true)

    // Simulate the AnimatePresence key={tool} swap unmounting/remounting
    // GoBar mid-job — the busy state must survive since it now lives in
    // the store, not a local useState.
    unmount()
    render(<GoBar />)
    expect(screen.getByRole("button", { name: /working/i }).hasAttribute("disabled")).toBe(true)
  })
})
