// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, render, screen } from "@testing-library/react"

import { useWorkspace } from "@/stores/workspace"

import { CropPanel } from "./crop-panel"

beforeEach(() => {
  global.URL.createObjectURL = vi.fn(() => "blob:mock-url") as any
  global.URL.revokeObjectURL = vi.fn() as any
})

afterEach(() => {
  cleanup()
  useWorkspace.setState({
    images: [],
    selectedIds: new Set(),
    options: useWorkspace.getInitialState().options,
  })
})

function addImage(name = "photo.png") {
  const file = new File(["a"], name, { type: "image/png" })
  useWorkspace.getState().addFiles([file])
  return useWorkspace.getState().images.at(-1)!
}

describe("CropPanel", () => {
  it("shows the aspect ratio segmented control in aspect mode", () => {
    useWorkspace.getState().setOption("crop", { mode: "aspect" })
    render(<CropPanel />)

    expect(screen.getByText("4:3")).toBeTruthy()
    expect(screen.getByText("16:9")).toBeTruthy()
  })

  it("hints to select an image when freeform has nothing selected", () => {
    useWorkspace.getState().setOption("crop", { mode: "rect" })
    render(<CropPanel />)

    expect(screen.getByText(/select an image to draw a freeform crop/i)).toBeTruthy()
  })

  it("hints to deselect extras when freeform has more than one image selected", () => {
    useWorkspace.getState().setOption("crop", { mode: "rect" })
    addImage("one.png")
    addImage("two.png")
    render(<CropPanel />)

    expect(screen.getByText(/needs exactly one selected image/i)).toBeTruthy()
  })

  it("renders no hint once freeform has exactly one previewable image selected", () => {
    useWorkspace.getState().setOption("crop", { mode: "rect" })
    addImage("only.png")
    render(<CropPanel />)

    expect(screen.queryByText(/select an image/i)).toBeNull()
    expect(screen.queryByText(/needs exactly one/i)).toBeNull()
  })
})
