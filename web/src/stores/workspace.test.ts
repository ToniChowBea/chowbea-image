import { describe, it, expect, beforeEach, vi, afterEach } from "vitest"
import { useWorkspace } from "./workspace"

// Mock URL.createObjectURL and revokeObjectURL since jsdom doesn't fully implement them
const mockCreateObjectURL = vi.fn()
const mockRevokeObjectURL = vi.fn()

beforeEach(() => {
  global.URL.createObjectURL = mockCreateObjectURL as any
  global.URL.revokeObjectURL = mockRevokeObjectURL as any
  mockCreateObjectURL.mockClear()
  mockRevokeObjectURL.mockClear()
  mockCreateObjectURL.mockImplementation(() => `blob:mock-${Math.random()}`)
})

afterEach(() => {
  // Reset the store between tests
  useWorkspace.setState({
    images: [],
    selectedIds: new Set(),
    activeTool: null,
    options: {
      convert: { target: "png", quality: 80 },
      compress: { quality: 70 },
      resize: {
        mode: "percent",
        width: null,
        height: null,
        lockAspect: true,
        percent: 100,
        preset: "1920",
      },
      rotate: { rotation: 0, flip: "none" },
      crop: { mode: "aspect", aspect: "1:1", rect: null },
    },
    progress: null,
    result: null,
    error: null,
  })
})

describe("useWorkspace store", () => {
  describe("initial state", () => {
    it("has empty images and selectedIds", () => {
      const state = useWorkspace.getState()
      expect(state.images).toEqual([])
      expect(state.selectedIds).toEqual(new Set())
    })

    it("has null activeTool", () => {
      const state = useWorkspace.getState()
      expect(state.activeTool).toBeNull()
    })

    it("has default tool options", () => {
      const state = useWorkspace.getState()
      expect(state.options).toEqual({
        convert: { target: "png", quality: 80 },
        compress: { quality: 70 },
        resize: {
          mode: "percent",
          width: null,
          height: null,
          lockAspect: true,
          percent: 100,
          preset: "1920",
        },
        rotate: { rotation: 0, flip: "none" },
        crop: { mode: "aspect", aspect: "1:1", rect: null },
      })
    })

    it("has null progress, result, and error", () => {
      const state = useWorkspace.getState()
      expect(state.progress).toBeNull()
      expect(state.result).toBeNull()
      expect(state.error).toBeNull()
    })
  })

  describe("addFiles", () => {
    it("creates a WorkspaceImage for each file", () => {
      const file = new File(["content"], "test.png", { type: "image/png" })
      useWorkspace.getState().addFiles([file])

      const state = useWorkspace.getState()
      expect(state.images).toHaveLength(1)
      const image = state.images[0]
      expect(image.file).toBe(file)
      expect(image.name).toBe("test.png")
      expect(image.size).toBe(7)
      expect(image.id).toBeDefined()
    })

    it("sets ext correctly for PNG files", () => {
      const file = new File(["content"], "image.png", { type: "image/png" })
      useWorkspace.getState().addFiles([file])

      expect(useWorkspace.getState().images[0].ext).toBe(".png")
    })

    it("sets ext correctly for HEIC files", () => {
      const file = new File(["content"], "photo.heic", { type: "image/heic" })
      useWorkspace.getState().addFiles([file])

      expect(useWorkspace.getState().images[0].ext).toBe(".heic")
    })

    it("sets previewable=true for browser-renderable formats", () => {
      const file = new File(["content"], "image.png", { type: "image/png" })
      useWorkspace.getState().addFiles([file])

      expect(useWorkspace.getState().images[0].previewable).toBe(true)
    })

    it("sets previewable=false for non-renderable formats like HEIC", () => {
      const file = new File(["content"], "photo.heic", { type: "image/heic" })
      useWorkspace.getState().addFiles([file])

      expect(useWorkspace.getState().images[0].previewable).toBe(false)
    })

    it("creates object URL for previewable images", () => {
      mockCreateObjectURL.mockReturnValue("blob:mock-png-url")
      const file = new File(["content"], "image.png", { type: "image/png" })

      useWorkspace.getState().addFiles([file])

      expect(mockCreateObjectURL).toHaveBeenCalledWith(file)
      expect(useWorkspace.getState().images[0].url).toBe("blob:mock-png-url")
    })

    it("sets url=null for non-previewable images", () => {
      const file = new File(["content"], "photo.heic", { type: "image/heic" })

      useWorkspace.getState().addFiles([file])

      expect(mockCreateObjectURL).not.toHaveBeenCalled()
      expect(useWorkspace.getState().images[0].url).toBeNull()
    })

    it("auto-selects newly added images", () => {
      const file = new File(["content"], "image.png", { type: "image/png" })

      useWorkspace.getState().addFiles([file])

      const id = useWorkspace.getState().images[0].id
      expect(useWorkspace.getState().selectedIds.has(id)).toBe(true)
    })

    it("handles multiple files", () => {
      const file1 = new File(["content1"], "image1.png", { type: "image/png" })
      const file2 = new File(["content2"], "image2.jpg", { type: "image/jpeg" })

      useWorkspace.getState().addFiles([file1, file2])

      expect(useWorkspace.getState().images).toHaveLength(2)
      expect(useWorkspace.getState().selectedIds.size).toBe(2)
    })

    it("appends to existing images", () => {
      const file1 = new File(["content1"], "image1.png", { type: "image/png" })
      const file2 = new File(["content2"], "image2.jpg", { type: "image/jpeg" })

      useWorkspace.getState().addFiles([file1])
      useWorkspace.getState().addFiles([file2])

      expect(useWorkspace.getState().images).toHaveLength(2)
    })
  })

  describe("removeImage", () => {
    it("removes image by id", () => {
      const file = new File(["content"], "image.png", { type: "image/png" })

      useWorkspace.getState().addFiles([file])

      const id = useWorkspace.getState().images[0].id
      useWorkspace.getState().removeImage(id)

      expect(useWorkspace.getState().images).toHaveLength(0)
    })

    it("revokes URL for previewable images", () => {
      mockCreateObjectURL.mockReturnValue("blob:mock-url")
      const file = new File(["content"], "image.png", { type: "image/png" })

      useWorkspace.getState().addFiles([file])

      const id = useWorkspace.getState().images[0].id
      const url = useWorkspace.getState().images[0].url

      useWorkspace.getState().removeImage(id)

      expect(mockRevokeObjectURL).toHaveBeenCalledWith(url)
    })

    it("does not revoke URL for non-previewable images (url is null)", () => {
      const file = new File(["content"], "photo.heic", { type: "image/heic" })

      useWorkspace.getState().addFiles([file])

      const id = useWorkspace.getState().images[0].id

      mockRevokeObjectURL.mockClear()
      useWorkspace.getState().removeImage(id)

      expect(mockRevokeObjectURL).not.toHaveBeenCalled()
    })

    it("removes image from selection", () => {
      const file = new File(["content"], "image.png", { type: "image/png" })

      useWorkspace.getState().addFiles([file])

      const id = useWorkspace.getState().images[0].id
      expect(useWorkspace.getState().selectedIds.has(id)).toBe(true)

      useWorkspace.getState().removeImage(id)

      expect(useWorkspace.getState().selectedIds.has(id)).toBe(false)
    })
  })

  describe("clear", () => {
    it("removes all images", () => {
      const file1 = new File(["content1"], "image1.png", { type: "image/png" })
      const file2 = new File(["content2"], "image2.jpg", { type: "image/jpeg" })

      useWorkspace.getState().addFiles([file1, file2])

      useWorkspace.getState().clear()

      expect(useWorkspace.getState().images).toHaveLength(0)
    })

    it("clears selection", () => {
      const file = new File(["content"], "image.png", { type: "image/png" })

      useWorkspace.getState().addFiles([file])

      useWorkspace.getState().clear()

      expect(useWorkspace.getState().selectedIds).toEqual(new Set())
    })

    it("revokes all object URLs", () => {
      mockCreateObjectURL.mockReturnValueOnce("blob:url1").mockReturnValueOnce("blob:url2")
      const file1 = new File(["content1"], "image1.png", { type: "image/png" })
      const file2 = new File(["content2"], "image2.jpg", { type: "image/jpeg" })

      useWorkspace.getState().addFiles([file1, file2])

      mockRevokeObjectURL.mockClear()
      useWorkspace.getState().clear()

      expect(mockRevokeObjectURL).toHaveBeenCalledWith("blob:url1")
      expect(mockRevokeObjectURL).toHaveBeenCalledWith("blob:url2")
      expect(mockRevokeObjectURL).toHaveBeenCalledTimes(2)
    })
  })

  describe("toggleSelect", () => {
    it("adds id to selection if not present", () => {
      const file = new File(["content"], "image.png", { type: "image/png" })

      useWorkspace.getState().addFiles([file])

      const id = useWorkspace.getState().images[0].id
      useWorkspace.getState().selectNone()
      expect(useWorkspace.getState().selectedIds.has(id)).toBe(false)

      useWorkspace.getState().toggleSelect(id)

      expect(useWorkspace.getState().selectedIds.has(id)).toBe(true)
    })

    it("removes id from selection if present", () => {
      const file = new File(["content"], "image.png", { type: "image/png" })

      useWorkspace.getState().addFiles([file])

      const id = useWorkspace.getState().images[0].id
      expect(useWorkspace.getState().selectedIds.has(id)).toBe(true)

      useWorkspace.getState().toggleSelect(id)

      expect(useWorkspace.getState().selectedIds.has(id)).toBe(false)
    })
  })

  describe("selectAll", () => {
    it("selects all images", () => {
      const file1 = new File(["content1"], "image1.png", { type: "image/png" })
      const file2 = new File(["content2"], "image2.jpg", { type: "image/jpeg" })

      useWorkspace.getState().addFiles([file1, file2])

      useWorkspace.getState().selectNone()
      expect(useWorkspace.getState().selectedIds.size).toBe(0)

      useWorkspace.getState().selectAll()

      expect(useWorkspace.getState().selectedIds.size).toBe(2)
      useWorkspace.getState().images.forEach((img) => {
        expect(useWorkspace.getState().selectedIds.has(img.id)).toBe(true)
      })
    })
  })

  describe("selectNone", () => {
    it("deselects all images", () => {
      const file = new File(["content"], "image.png", { type: "image/png" })

      useWorkspace.getState().addFiles([file])

      expect(useWorkspace.getState().selectedIds.size).toBe(1)

      useWorkspace.getState().selectNone()

      expect(useWorkspace.getState().selectedIds).toEqual(new Set())
    })
  })

  describe("setActiveTool", () => {
    it("sets the active tool", () => {
      useWorkspace.getState().setActiveTool("convert")

      expect(useWorkspace.getState().activeTool).toBe("convert")
    })

    it("can set to null", () => {
      useWorkspace.getState().setActiveTool("resize")

      useWorkspace.getState().setActiveTool(null)

      expect(useWorkspace.getState().activeTool).toBeNull()
    })
  })

  describe("setOption", () => {
    it("merges convert options", () => {
      useWorkspace.getState().setOption("convert", { quality: 90 })

      expect(useWorkspace.getState().options.convert).toEqual({
        target: "png",
        quality: 90,
      })
    })

    it("merges compress options", () => {
      useWorkspace.getState().setOption("compress", { quality: 85 })

      expect(useWorkspace.getState().options.compress).toEqual({
        quality: 85,
      })
    })

    it("merges resize options", () => {
      useWorkspace.getState().setOption("resize", { width: 1920, mode: "pixel" })

      expect(useWorkspace.getState().options.resize).toEqual({
        mode: "pixel",
        width: 1920,
        height: null,
        lockAspect: true,
        percent: 100,
        preset: "1920",
      })
    })

    it("merges rotate options", () => {
      useWorkspace.getState().setOption("rotate", { rotation: 90, flip: "horizontal" })

      expect(useWorkspace.getState().options.rotate).toEqual({
        rotation: 90,
        flip: "horizontal",
      })
    })

    it("merges crop options", () => {
      useWorkspace.getState().setOption("crop", { aspect: "16:9", mode: "freeform" })

      expect(useWorkspace.getState().options.crop).toEqual({
        mode: "freeform",
        aspect: "16:9",
        rect: null,
      })
    })

    it("does not replace entire object, only merges", () => {
      useWorkspace.getState().setOption("resize", { percent: 50 })

      // All other resize options should remain unchanged
      expect(useWorkspace.getState().options.resize.mode).toBe("percent")
      expect(useWorkspace.getState().options.resize.width).toBeNull()
      expect(useWorkspace.getState().options.resize.lockAspect).toBe(true)
      expect(useWorkspace.getState().options.resize.preset).toBe("1920")
      expect(useWorkspace.getState().options.resize.percent).toBe(50)
    })
  })

  describe("setProgress", () => {
    it("sets progress", () => {
      const progress = { phase: "queued" as const, percent: null }
      useWorkspace.getState().setProgress(progress)

      expect(useWorkspace.getState().progress).toEqual(progress)
    })

    it("can set to null", () => {
      const progress = { phase: "queued" as const, percent: null }
      useWorkspace.getState().setProgress(progress)

      useWorkspace.getState().setProgress(null)

      expect(useWorkspace.getState().progress).toBeNull()
    })
  })

  describe("setResult", () => {
    it("sets result", () => {
      const blob = new Blob(["result"])
      const resultData = { blob, filename: "output.png" }
      useWorkspace.getState().setResult(resultData)

      expect(useWorkspace.getState().result).toEqual(resultData)
    })

    it("can set to null", () => {
      const blob = new Blob(["result"])
      const resultData = { blob, filename: "output.png" }
      useWorkspace.getState().setResult(resultData)

      useWorkspace.getState().setResult(null)

      expect(useWorkspace.getState().result).toBeNull()
    })
  })

  describe("setError", () => {
    it("sets error message", () => {
      useWorkspace.getState().setError("Something went wrong")

      expect(useWorkspace.getState().error).toBe("Something went wrong")
    })

    it("can set to null", () => {
      useWorkspace.getState().setError("Error")

      useWorkspace.getState().setError(null)

      expect(useWorkspace.getState().error).toBeNull()
    })
  })

  describe("reset", () => {
    it("clears progress, result, and error", () => {
      useWorkspace.getState().setProgress({ phase: "processing", percent: null })

      useWorkspace.getState().setResult({ blob: new Blob(), filename: "out.png" })

      useWorkspace.getState().setError("Some error")

      useWorkspace.getState().reset()

      expect(useWorkspace.getState().progress).toBeNull()
      expect(useWorkspace.getState().result).toBeNull()
      expect(useWorkspace.getState().error).toBeNull()
    })

    it("preserves images and selection", () => {
      const file = new File(["content"], "image.png", { type: "image/png" })

      useWorkspace.getState().addFiles([file])

      const id = useWorkspace.getState().images[0].id

      useWorkspace.getState().setProgress({ phase: "processing", percent: null })
      useWorkspace.getState().setError("Error")
      useWorkspace.getState().reset()

      expect(useWorkspace.getState().images).toHaveLength(1)
      expect(useWorkspace.getState().selectedIds.has(id)).toBe(true)
    })
  })
})
