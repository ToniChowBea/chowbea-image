// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest"
import { cleanup, render, screen } from "@testing-library/react"

import { useWorkspace } from "@/stores/workspace"

import { ConvertPanel } from "./convert-panel"

afterEach(() => {
  cleanup()
  useWorkspace.setState({ options: useWorkspace.getInitialState().options })
})

describe("ConvertPanel", () => {
  it("hides the quality slider for a lossless target (png)", () => {
    useWorkspace.getState().setOption("convert", { target: "png" })
    render(<ConvertPanel />)

    expect(screen.queryByText("Quality")).toBeNull()
  })

  it("shows the quality slider for a lossy target (jpeg)", () => {
    useWorkspace.getState().setOption("convert", { target: "jpeg" })
    render(<ConvertPanel />)

    expect(screen.getByText("Quality")).toBeTruthy()
  })
})
