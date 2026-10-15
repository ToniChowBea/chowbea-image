// @vitest-environment jsdom
import type { ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"

import { useWorkspace } from "@/stores/workspace"

import { Landing } from "./landing"

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    to,
    children,
    ...props
  }: {
    to: string
    children: ReactNode
    [key: string]: unknown
  }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}))

beforeEach(() => {
  global.URL.createObjectURL = vi.fn(() => "blob:mock-url") as any
  global.URL.revokeObjectURL = vi.fn() as any
})

afterEach(() => {
  cleanup()
  useWorkspace.setState({
    images: [],
    selectedIds: new Set(),
    activeTool: null,
  })
})

describe("Landing", () => {
  it("shows the hero, five tools, and the UK portal fixer", () => {
    render(<Landing />)

    expect(screen.getByText("Pick a tool.")).toBeTruthy()
    expect(screen.getByText("Drop an image.")).toBeTruthy()
    expect(screen.getByRole("button", { name: /upload images/i })).toBeTruthy()

    for (const label of ["Convert", "Compress", "Resize", "Rotate", "Crop"]) {
      expect(
        screen.getByRole("button", { name: new RegExp(label, "i") })
      ).toBeTruthy()
    }

    const fixLink = screen.getByRole("link", { name: /fix for a uk portal/i })
    expect(fixLink.getAttribute("href")).toBe("/fix")
  })

  it("selects a workspace tool when a tile is clicked", () => {
    render(<Landing />)

    expect(useWorkspace.getState().activeTool).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: /compress/i }))
    expect(useWorkspace.getState().activeTool).toBe("compress")
    expect(
      screen.getByText("Compress is ready — drop files anywhere.")
    ).toBeTruthy()
  })

  it("adds dropped images to the workspace store", () => {
    render(<Landing />)

    const file = new File(["a"], "photo.png", { type: "image/png" })
    const skip = new File(["b"], "notes.pdf", { type: "application/pdf" })
    fireEvent.drop(screen.getByTestId("landing"), {
      dataTransfer: {
        types: ["Files"],
        files: [file, skip],
      },
    })

    const names = useWorkspace.getState().images.map((image) => image.name)
    expect(names).toEqual(["photo.png"])
  })
})
