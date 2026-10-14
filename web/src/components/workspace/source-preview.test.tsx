// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, render, screen } from "@testing-library/react"

import { useWorkspace } from "@/stores/workspace"

import { SourcePreview } from "./source-preview"

beforeEach(() => {
  global.URL.createObjectURL = vi.fn(
    () => "blob:mock-url"
  ) as unknown as typeof URL.createObjectURL
  global.URL.revokeObjectURL = vi.fn() as unknown as typeof URL.revokeObjectURL
})

afterEach(() => {
  cleanup()
  useWorkspace.setState({ images: [], selectedIds: new Set() })
})

describe("SourcePreview", () => {
  it("asks the user to select an image when nothing is selected", () => {
    render(<SourcePreview />)
    expect(screen.getByText(/select an image to preview/i)).toBeTruthy()
  })

  it("renders the selected image as a before preview", () => {
    const file = new File(["a"], "photo.png", { type: "image/png" })
    useWorkspace.getState().addFiles([file])

    render(<SourcePreview />)

    expect(screen.getByText("Before")).toBeTruthy()
    expect(
      screen.getByRole("img", { name: /selected: photo.png/i })
    ).toBeTruthy()
  })

  it("falls back to a type chip for a non-previewable format", () => {
    const file = new File(["a"], "scan.heic", { type: "image/heic" })
    useWorkspace.getState().addFiles([file])

    render(<SourcePreview />)

    expect(screen.queryByRole("img")).toBeNull()
    expect(screen.getByText("HEIC")).toBeTruthy()
  })
})
