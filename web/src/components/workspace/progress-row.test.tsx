// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest"
import { cleanup, render, screen } from "@testing-library/react"

import { useWorkspace } from "@/stores/workspace"

import { ProgressRow } from "./progress-row"

afterEach(() => {
  cleanup()
  useWorkspace.setState({ progress: null })
})

describe("ProgressRow", () => {
  it("shows idle copy when no job is running", () => {
    render(<ProgressRow />)
    expect(screen.getByText(/nothing running yet/i)).toBeTruthy()
  })

  it("shows a percent for the uploading phase", () => {
    useWorkspace.getState().setProgress({ phase: "uploading", percent: 42 })
    render(<ProgressRow />)
    expect(screen.getByText("42%")).toBeTruthy()
  })

  it("shows the queue position for the queued phase", () => {
    useWorkspace.getState().setProgress({
      phase: "queued",
      percent: null,
      position: 2,
      queueSize: 5,
    })
    render(<ProgressRow />)
    expect(screen.getByText("Queued — position 2 of 5")).toBeTruthy()
  })

  it("shows the Bold Blocks indeterminate slide for the processing phase", () => {
    useWorkspace.getState().setProgress({ phase: "processing", percent: null })
    const { container } = render(<ProgressRow />)
    expect(screen.getByText("Processing…")).toBeTruthy()
    expect(container.querySelector(".animate-indeterminate")).toBeTruthy()
  })

  it("shows a percent for the downloading phase", () => {
    useWorkspace.getState().setProgress({ phase: "downloading", percent: 77 })
    render(<ProgressRow />)
    expect(screen.getByText("77%")).toBeTruthy()
  })
})
