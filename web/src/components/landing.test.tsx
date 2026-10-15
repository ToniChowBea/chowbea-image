// @vitest-environment jsdom
import type { ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"

import { Workspace } from "@/components/workspace/workspace"
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

/** Mirrors the index route: landing until files land, then the workspace. */
function Home() {
  const hasImages = useWorkspace((state) => state.images.length > 0)
  if (!hasImages) return <Landing />
  return <Workspace />
}

beforeEach(() => {
  global.URL.createObjectURL = vi.fn(() => "blob:mock-url") as any
  global.URL.revokeObjectURL = vi.fn() as any
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  useWorkspace.setState({
    images: [],
    selectedIds: new Set(),
    activeTool: null,
  })
})

/** Hidden file input shared by the Upload button and tool tiles. */
function fileInput() {
  return document.querySelector('input[type="file"]') as HTMLInputElement
}

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

  it("opens the file picker and pre-selects the tool when a tile is clicked with no images", () => {
    render(<Landing />)
    const clickSpy = vi.spyOn(fileInput(), "click").mockImplementation(() => {})

    expect(useWorkspace.getState().activeTool).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: /compress/i }))

    expect(useWorkspace.getState().activeTool).toBe("compress")
    expect(clickSpy).toHaveBeenCalledTimes(1)
    expect(
      screen.getByText("Compress is ready — drop files anywhere.")
    ).toBeTruthy()
  })

  it("opens the workspace with that tool once files are chosen from a tile", () => {
    render(<Home />)
    const input = fileInput()
    vi.spyOn(input, "click").mockImplementation(() => {})

    fireEvent.click(screen.getByRole("button", { name: /resize/i }))
    expect(useWorkspace.getState().activeTool).toBe("resize")

    const file = new File(["a"], "photo.png", { type: "image/png" })
    fireEvent.change(input, { target: { files: [file] } })

    expect(useWorkspace.getState().images.map((image) => image.name)).toEqual([
      "photo.png",
    ])
    expect(useWorkspace.getState().activeTool).toBe("resize")
    // Landing has swapped for the workspace toolbar.
    expect(screen.queryByTestId("landing")).toBeNull()
    expect(screen.getByRole("group", { name: /image tools/i })).toBeTruthy()
    expect(
      screen
        .getByRole("button", { name: /resize/i })
        .getAttribute("aria-pressed")
    ).toBe("true")
  })

  it("selects the tool without opening the picker when images are already loaded", () => {
    const existing = new File(["a"], "photo.png", { type: "image/png" })
    useWorkspace.getState().addFiles([existing])

    render(<Landing />)
    const clickSpy = vi.spyOn(fileInput(), "click").mockImplementation(() => {})

    fireEvent.click(screen.getByRole("button", { name: /crop/i }))

    expect(useWorkspace.getState().activeTool).toBe("crop")
    expect(clickSpy).not.toHaveBeenCalled()
  })

  it("opens the file picker from Upload without selecting a tool", () => {
    render(<Landing />)
    const clickSpy = vi.spyOn(fileInput(), "click").mockImplementation(() => {})

    fireEvent.click(screen.getByRole("button", { name: /upload images/i }))

    expect(clickSpy).toHaveBeenCalledTimes(1)
    expect(useWorkspace.getState().activeTool).toBeNull()
  })

  it("sends the UK portal card to /fix without opening the picker or selecting a tool", () => {
    render(<Landing />)
    const clickSpy = vi.spyOn(fileInput(), "click").mockImplementation(() => {})

    fireEvent.click(screen.getByRole("link", { name: /fix for a uk portal/i }))

    expect(clickSpy).not.toHaveBeenCalled()
    expect(useWorkspace.getState().activeTool).toBeNull()
  })

  it("shows buy-me-a-coffee amounts in pounds", () => {
    render(<Landing />)

    expect(screen.getByRole("link", { name: "£3" })).toBeTruthy()
    expect(screen.getByRole("link", { name: "£5" })).toBeTruthy()
    expect(screen.getByRole("link", { name: "£10" })).toBeTruthy()
    expect(screen.queryByRole("link", { name: "$3" })).toBeNull()
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
