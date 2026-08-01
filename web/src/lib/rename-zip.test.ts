import { describe, expect, it } from "vitest"

import { dedupeNames } from "./rename-zip"

describe("dedupeNames", () => {
  it("leaves unique names unchanged", () => {
    const names = ["a.png", "b.jpg", "c.gif"]
    expect(dedupeNames(names)).toEqual(["a.png", "b.jpg", "c.gif"])
  })

  it("disambiguates duplicate names with -2, -3, etc", () => {
    const names = ["a.png", "a.png"]
    expect(dedupeNames(names)).toEqual(["a.png", "a-2.png"])
  })

  it("handles multiple duplicates of the same name", () => {
    const names = ["a.png", "a.png", "a.png"]
    expect(dedupeNames(names)).toEqual(["a.png", "a-2.png", "a-3.png"])
  })

  it("avoids colliding with existing files", () => {
    const names = ["logo.png", "logo.jpg", "logo-2.png"]
    expect(dedupeNames(names)).toEqual(["logo.png", "logo.jpg", "logo-2.png"])
  })

  it("handles collision when generated name collides with real file", () => {
    const names = ["a.png", "a.png", "a-2.png"]
    // "a.png" → "a.png"
    // "a.png" → "a-2.png" (collides with "a.png")
    // "a-2.png" → "a-2-2.png" (collides with existing "a-2.png")
    expect(dedupeNames(names)).toEqual(["a.png", "a-2.png", "a-2-2.png"])
  })

  it("preserves file extensions", () => {
    const names = ["image.jpg", "image.jpg"]
    expect(dedupeNames(names)).toEqual(["image.jpg", "image-2.jpg"])
  })

  it("handles files with multiple dots", () => {
    const names = ["photo.backup.png", "photo.backup.png"]
    expect(dedupeNames(names)).toEqual(["photo.backup.png", "photo.backup-2.png"])
  })

  it("handles mixed case extensions", () => {
    const names = ["image.PNG", "image.PNG"]
    expect(dedupeNames(names)).toEqual(["image.PNG", "image-2.PNG"])
  })

  it("returns empty array for empty input", () => {
    expect(dedupeNames([])).toEqual([])
  })
})
