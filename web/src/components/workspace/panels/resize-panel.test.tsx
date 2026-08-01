// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest"
import { cleanup, render, screen } from "@testing-library/react"

import { useWorkspace } from "@/stores/workspace"

import { ResizePanel } from "./resize-panel"

afterEach(() => {
  cleanup()
  useWorkspace.setState({ options: useWorkspace.getInitialState().options })
})

describe("ResizePanel", () => {
  it("shows width/height fields for dimensions mode only", () => {
    useWorkspace.getState().setOption("resize", { mode: "dimensions" })
    render(<ResizePanel />)

    expect(screen.getByText("Width")).toBeTruthy()
    expect(screen.getByText("Height")).toBeTruthy()
    expect(screen.queryByText("Scale")).toBeNull()
  })

  it("shows the scale slider for percent mode only", () => {
    useWorkspace.getState().setOption("resize", { mode: "percent" })
    render(<ResizePanel />)

    expect(screen.getByText("Scale")).toBeTruthy()
    expect(screen.queryByText("Width")).toBeNull()
  })

  it("shows preset buttons for preset mode only", () => {
    useWorkspace.getState().setOption("resize", { mode: "preset" })
    render(<ResizePanel />)

    expect(screen.getByText("1920px")).toBeTruthy()
    expect(screen.queryByText("Scale")).toBeNull()
  })
})
