import { describe, expect, it } from "vitest"

import { SUPPORTED_EXTS, extOf, isBrowserRenderable, kindLabel, objectUrlFor, revokeUrl } from "./images"

describe("SUPPORTED_EXTS", () => {
  it("contains all supported image extensions", () => {
    expect(SUPPORTED_EXTS).toContain("png")
    expect(SUPPORTED_EXTS).toContain("jpg")
    expect(SUPPORTED_EXTS).toContain("jpeg")
    expect(SUPPORTED_EXTS).toContain("webp")
    expect(SUPPORTED_EXTS).toContain("avif")
    expect(SUPPORTED_EXTS).toContain("heic")
    expect(SUPPORTED_EXTS).toContain("heif")
    expect(SUPPORTED_EXTS).toContain("gif")
    expect(SUPPORTED_EXTS).toContain("tif")
    expect(SUPPORTED_EXTS).toContain("tiff")
    expect(SUPPORTED_EXTS).toContain("bmp")
  })

  it("is a Set", () => {
    expect(SUPPORTED_EXTS instanceof Set).toBe(true)
  })
})

describe("extOf", () => {
  it("returns lowercase extension with dot", () => {
    expect(extOf("photo.PNG")).toBe(".png")
    expect(extOf("image.JPG")).toBe(".jpg")
    expect(extOf("file.TiFF")).toBe(".tiff")
  })

  it("handles lowercase extensions", () => {
    expect(extOf("photo.png")).toBe(".png")
    expect(extOf("image.jpg")).toBe(".jpg")
  })

  it("returns empty string for files with no extension", () => {
    expect(extOf("photofile")).toBe("")
  })

  it("handles multiple dots in filename", () => {
    expect(extOf("photo.backup.png")).toBe(".png")
  })
})

describe("isBrowserRenderable", () => {
  it("returns true for browser-renderable formats", () => {
    expect(isBrowserRenderable("photo.png")).toBe(true)
    expect(isBrowserRenderable("photo.jpg")).toBe(true)
    expect(isBrowserRenderable("photo.jpeg")).toBe(true)
    expect(isBrowserRenderable("photo.webp")).toBe(true)
    expect(isBrowserRenderable("photo.gif")).toBe(true)
    expect(isBrowserRenderable("photo.bmp")).toBe(true)
    expect(isBrowserRenderable("photo.avif")).toBe(true)
  })

  it("returns false for non-renderable formats", () => {
    expect(isBrowserRenderable("photo.heic")).toBe(false)
    expect(isBrowserRenderable("photo.heif")).toBe(false)
    expect(isBrowserRenderable("photo.tif")).toBe(false)
    expect(isBrowserRenderable("photo.tiff")).toBe(false)
  })

  it("is case-insensitive", () => {
    expect(isBrowserRenderable("photo.PNG")).toBe(true)
    expect(isBrowserRenderable("photo.HEIC")).toBe(false)
  })
})

describe("kindLabel", () => {
  it("returns uppercased extension without dot", () => {
    expect(kindLabel("photo.png")).toBe("PNG")
    expect(kindLabel("photo.jpg")).toBe("JPG")
    expect(kindLabel("photo.heic")).toBe("HEIC")
    expect(kindLabel("photo.tiff")).toBe("TIFF")
  })

  it("handles various cases", () => {
    expect(kindLabel("photo.PNG")).toBe("PNG")
    expect(kindLabel("photo.JpEg")).toBe("JPEG")
  })
})

describe("objectUrlFor", () => {
  it("creates an object URL from a File", () => {
    const file = new File(["test"], "test.png", { type: "image/png" })
    const url = objectUrlFor(file)
    expect(url).toMatch(/^blob:/)
  })
})

describe("revokeUrl", () => {
  it("revokes a blob URL", () => {
    const file = new File(["test"], "test.png", { type: "image/png" })
    const url = objectUrlFor(file)
    expect(() => revokeUrl(url)).not.toThrow()
  })
})
