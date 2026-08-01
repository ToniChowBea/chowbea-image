// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"

import { useWorkspace } from "@/stores/workspace"

import { ResultCard } from "./result-card"

beforeEach(() => {
  global.URL.createObjectURL = vi.fn(() => "blob:mock-url") as any
  global.URL.revokeObjectURL = vi.fn() as any
})

afterEach(() => {
  cleanup()
  useWorkspace.setState({
    images: [],
    selectedIds: new Set(),
    result: null,
  })
})

function addSelected(name: string, sizeBytes: number) {
  const file = new File([new Uint8Array(sizeBytes)], name, { type: "image/png" })
  useWorkspace.getState().addFiles([file])
  return useWorkspace.getState().images.at(-1)!
}

describe("ResultCard", () => {
  it("renders nothing when there's no result", () => {
    const { container } = render(<ResultCard />)
    expect(container.firstChild).toBeNull()
  })

  it("shows a before/after and the size delta for a single-file result", () => {
    addSelected("photo.png", 1000)
    useWorkspace.getState().setResult({
      blob: new Blob([new Uint8Array(200)]),
      filename: "converted-photo.jpg",
    })

    render(<ResultCard />)

    expect(screen.getByText("Done")).toBeTruthy()
    // 1000 B -> 200 B is an 80% reduction.
    expect(screen.getByText("-80%")).toBeTruthy()
    expect(screen.getByRole("button", { name: /download/i })).toBeTruthy()
  })

  it("shows an 'N images · ZIP' summary instead of a thumbnail when the result is a zip", () => {
    addSelected("a.png", 500)
    addSelected("b.png", 500)
    useWorkspace.getState().selectAll()
    useWorkspace.getState().setResult({
      blob: new Blob([new Uint8Array(400)]),
      filename: "converted-images.zip",
    })

    render(<ResultCard />)

    expect(screen.getByText("2 images · ZIP")).toBeTruthy()
    expect(screen.queryByText("Before")).toBeNull()
  })

  it("Start over clears the result via reset()", () => {
    addSelected("photo.png", 1000)
    useWorkspace.getState().setResult({
      blob: new Blob([new Uint8Array(200)]),
      filename: "converted-photo.jpg",
    })

    render(<ResultCard />)
    fireEvent.click(screen.getByRole("button", { name: /start over/i }))

    expect(useWorkspace.getState().result).toBeNull()
  })
})
