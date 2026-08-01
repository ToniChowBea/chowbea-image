import { describe, expect, it } from "vitest"

import { ASPECTS, centeredBox, clampRect } from "./crop"

describe("ASPECTS", () => {
  it("has the standard aspect ratios", () => {
    expect(ASPECTS).toEqual({
      "1:1": [1, 1],
      "4:3": [4, 3],
      "16:9": [16, 9],
      "9:16": [9, 16],
    })
  })
})

describe("centeredBox", () => {
  it("centers a 1:1 square in a 400×200 rect", () => {
    const box = centeredBox(400, 200, 1, 1)
    expect(box).toEqual({ x: 100, y: 0, width: 200, height: 200 })
  })

  it("width-limits a 16:9 rect in 400×200", () => {
    const box = centeredBox(400, 200, 16, 9)
    // height=200, width=round(200*16/9)=356, x=(400-356)/2=22, y=0
    expect(box).toEqual({ x: 22, y: 0, width: 356, height: 200 })
  })

  it("height-limits a 9:16 rect in 400×200", () => {
    // w*ratio_h >= h*ratio_w?
    // 400*16 >= 200*9 → 6400 >= 1800 → yes, height-limited
    // crop_h = 200, crop_w = pyRound(200*9/16) = pyRound(112.5) = 112 (banker's rounding, 112 is even)
    // x = (400-112)/2 = 144, y = 0
    const box = centeredBox(400, 200, 9, 16)
    expect(box).toEqual({ x: 144, y: 0, width: 112, height: 200 })
  })

  it("returns centered box for 1:1 in square", () => {
    const box = centeredBox(100, 100, 1, 1)
    expect(box).toEqual({ x: 0, y: 0, width: 100, height: 100 })
  })

  it("handles 4:3 aspect ratio", () => {
    const box = centeredBox(800, 600, 4, 3)
    // 800*3 >= 600*4 → 2400 >= 2400 → yes, height-limited (equal, so height)
    // crop_h = 600, crop_w = round(600*4/3) = 800
    // x = (800-800)/2 = 0, y = 0
    expect(box).toEqual({ x: 0, y: 0, width: 800, height: 600 })
  })

  it("uses banker's rounding to match Python's round() for .5 ties", () => {
    // Regression test: JS Math.round vs Python round on exact .5
    // 712*9/16 = 400.5, JS rounds UP to 401, Python banker's rounds to 400 (even)
    const box = centeredBox(712, 1000, 16, 9)
    expect(box).toEqual({ x: 0, y: 300, width: 712, height: 400 })
  })
})

describe("clampRect", () => {
  it("keeps rect within bounds", () => {
    const rect = { x: 10, y: 20, width: 100, height: 50 }
    const clamped = clampRect(rect, { width: 200, height: 150 })
    expect(clamped).toEqual({ x: 10, y: 20, width: 100, height: 50 })
  })

  it("clamps x to be non-negative", () => {
    const rect = { x: -10, y: 20, width: 100, height: 50 }
    const clamped = clampRect(rect, { width: 200, height: 150 })
    expect(clamped).toEqual({ x: 0, y: 20, width: 100, height: 50 })
  })

  it("clamps y to be non-negative", () => {
    const rect = { x: 10, y: -5, width: 100, height: 50 }
    const clamped = clampRect(rect, { width: 200, height: 150 })
    expect(clamped).toEqual({ x: 10, y: 0, width: 100, height: 50 })
  })

  it("clamps width to stay within bounds", () => {
    const rect = { x: 150, y: 20, width: 100, height: 50 }
    const clamped = clampRect(rect, { width: 200, height: 150 })
    expect(clamped).toEqual({ x: 150, y: 20, width: 50, height: 50 })
  })

  it("clamps height to stay within bounds", () => {
    const rect = { x: 10, y: 120, width: 100, height: 100 }
    const clamped = clampRect(rect, { width: 200, height: 150 })
    expect(clamped).toEqual({ x: 10, y: 120, width: 100, height: 30 })
  })

  it("ensures minimum width of 1px", () => {
    const rect = { x: 200, y: 20, width: 100, height: 50 }
    const clamped = clampRect(rect, { width: 200, height: 150 })
    expect(clamped).toEqual({ x: 199, y: 20, width: 1, height: 50 })
  })

  it("ensures minimum height of 1px", () => {
    const rect = { x: 10, y: 150, width: 100, height: 50 }
    const clamped = clampRect(rect, { width: 200, height: 150 })
    expect(clamped).toEqual({ x: 10, y: 149, width: 100, height: 1 })
  })
})
