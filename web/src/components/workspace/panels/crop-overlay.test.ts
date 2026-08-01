import { describe, expect, it } from "vitest"

import { moveRect, resizeRect } from "./crop-overlay"

const BOUNDS = { width: 400, height: 400 }

describe("moveRect", () => {
  it("translates by the pointer delta", () => {
    const box = { x: 50, y: 50, width: 100, height: 100 }
    expect(moveRect(box, 20, -10, BOUNDS)).toEqual({ x: 70, y: 40, width: 100, height: 100 })
  })

  it("stops at the far edge instead of shrinking the box", () => {
    const box = { x: 300, y: 50, width: 100, height: 100 }
    // Dragging far right/down would push x+width past 400 — moveRect must
    // clamp position and leave width/height untouched (unlike clampRect,
    // which would shrink width to fit).
    expect(moveRect(box, 500, 500, BOUNDS)).toEqual({ x: 300, y: 300, width: 100, height: 100 })
  })
})

describe("resizeRect", () => {
  it("keeps the opposite corner anchored when dragging nw outward", () => {
    // Bottom-right corner (200,200) must stay fixed while the top-left
    // corner follows the pointer.
    const box = { x: 100, y: 100, width: 100, height: 100 }
    expect(resizeRect("nw", box, -50, -50, BOUNDS)).toEqual({ x: 50, y: 50, width: 150, height: 150 })
  })

  it("caps growth at the image bounds without shifting the anchored corner", () => {
    const box = { x: 100, y: 100, width: 100, height: 100 }
    // se handle dragged far past the 400×400 bounds — width/height cap at
    // the edge, x/y (the anchored top-left corner) stay put.
    expect(resizeRect("se", box, 1000, 1000, BOUNDS)).toEqual({ x: 100, y: 100, width: 300, height: 300 })
  })

  it("never crosses/inverts past the opposite corner", () => {
    const box = { x: 100, y: 100, width: 100, height: 100 }
    // nw dragged far past the se corner (200,200) — width/height floor at
    // MIN_BOX (32) instead of going negative.
    expect(resizeRect("nw", box, 1000, 1000, BOUNDS)).toEqual({ x: 168, y: 168, width: 32, height: 32 })
  })
})
