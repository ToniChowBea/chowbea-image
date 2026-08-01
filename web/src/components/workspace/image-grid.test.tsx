// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, render, screen } from "@testing-library/react"

import { useWorkspace } from "@/stores/workspace"

import { ImageGrid } from "./image-grid"

beforeEach(() => {
  global.URL.createObjectURL = vi.fn(() => "blob:mock-url") as any
  global.URL.revokeObjectURL = vi.fn() as any
})

afterEach(() => {
  cleanup()
  useWorkspace.setState({ images: [], selectedIds: new Set() })
})

describe("ImageGrid", () => {
  it("renders both image names and shows a placeholder (not an <img>) for a non-previewable format", () => {
    const png = new File(["a"], "photo.png", { type: "image/png" })
    const heic = new File(["b"], "vacation.heic", { type: "image/heic" })
    useWorkspace.getState().addFiles([png, heic])

    render(<ImageGrid />)

    expect(screen.getByText("photo.png")).toBeTruthy()
    expect(screen.getByText("vacation.heic")).toBeTruthy()

    // PNG is browser-renderable, so it gets a real <img>.
    expect(screen.getByRole("img", { name: "photo.png" })).toBeTruthy()
    // HEIC is not, so it falls back to the filetype chip instead of an <img>.
    expect(screen.queryByRole("img", { name: "vacation.heic" })).toBeNull()
    expect(screen.getByText("HEIC")).toBeTruthy()
  })
})
