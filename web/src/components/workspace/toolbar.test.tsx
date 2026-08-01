// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"

import { useWorkspace } from "@/stores/workspace"

import { Toolbar } from "./toolbar"

afterEach(() => {
  cleanup()
  useWorkspace.setState({ activeTool: null })
})

describe("Toolbar", () => {
  it("renders all five tools and activates one on click", () => {
    render(<Toolbar />)

    for (const label of ["Convert", "Compress", "Resize", "Rotate", "Crop"]) {
      expect(screen.getByText(label)).toBeTruthy()
    }

    expect(useWorkspace.getState().activeTool).toBeNull()

    fireEvent.click(screen.getByRole("button", { name: /resize/i }))

    expect(useWorkspace.getState().activeTool).toBe("resize")
    expect(
      screen.getByRole("button", { name: /resize/i }).getAttribute("aria-pressed")
    ).toBe("true")
  })
})
