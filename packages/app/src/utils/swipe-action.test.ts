import { describe, expect, test } from "bun:test"
import { createSwipeGesture } from "./swipe-action"

function gesture(input: { width?: number; direction?: 1 | -1 } = {}) {
  return createSwipeGesture({ width: input.width ?? 300, direction: input.direction ?? 1 })
}

describe("createSwipeGesture", () => {
  test("ignores movement below the axis lock", () => {
    const swipe = gesture()
    swipe.onPointerDown(100, 100)
    swipe.onPointerMove(105, 104)
    expect(swipe.offset()).toBe(0)
    expect(swipe.onPointerUp()).toBe("reset")
  })

  test("cancels on vertical movement", () => {
    const swipe = gesture()
    swipe.onPointerDown(100, 100)
    swipe.onPointerMove(104, 160)
    swipe.onPointerMove(90, 100)
    expect(swipe.onPointerUp()).toBe("reset")
    expect(swipe.offset()).toBe(0)
  })

  test("snaps back when released under the reveal threshold", () => {
    const swipe = gesture()
    swipe.onPointerDown(100, 100)
    swipe.onPointerMove(60, 100)
    expect(swipe.offset()).toBe(-40)
    expect(swipe.onPointerUp()).toBe("reset")
    expect(swipe.offset()).toBe(0)
  })

  test("reveals and keeps the reveal offset", () => {
    const swipe = gesture()
    swipe.onPointerDown(100, 100)
    swipe.onPointerMove(20, 100)
    expect(swipe.onPointerUp()).toBe("reveal")
    expect(swipe.offset()).toBe(-64)
  })

  test("commits once past the commit threshold", () => {
    const swipe = gesture()
    swipe.onPointerDown(100, 100)
    swipe.onPointerMove(-20, 100)
    expect(swipe.offset()).toBe(-120)
    expect(swipe.onPointerUp()).toBe("commit")
    expect(swipe.onPointerUp()).toBe("commit")
    expect(swipe.offset()).toBe(-300)
  })

  test("clamps to the row width", () => {
    const swipe = gesture()
    swipe.onPointerDown(100, 100)
    swipe.onPointerMove(-400, 100)
    expect(swipe.offset()).toBe(-300)
    expect(swipe.onPointerUp()).toBe("commit")
  })

  test("mirrors the direction for right-to-left layouts", () => {
    const swipe = gesture({ direction: -1 })
    swipe.onPointerDown(100, 100)
    swipe.onPointerMove(170, 100)
    expect(swipe.offset()).toBe(70)
    expect(swipe.onPointerUp()).toBe("reveal")
    expect(swipe.offset()).toBe(64)
  })

  test("ignores swipes away from the reveal side", () => {
    const ltr = gesture()
    ltr.onPointerDown(100, 100)
    ltr.onPointerMove(180, 100)
    expect(ltr.offset()).toBe(0)
    expect(ltr.onPointerUp()).toBe("reset")

    const rtl = gesture({ direction: -1 })
    rtl.onPointerDown(100, 100)
    rtl.onPointerMove(20, 100)
    expect(rtl.offset()).toBe(0)
    expect(rtl.onPointerUp()).toBe("reset")
  })

  test("pointercancel resets the gesture", () => {
    const swipe = gesture()
    swipe.onPointerDown(100, 100)
    swipe.onPointerMove(20, 100)
    swipe.onPointerCancel()
    expect(swipe.offset()).toBe(0)
    expect(swipe.onPointerUp()).toBe("reset")
  })

  test("a tap without movement resets a revealed row", () => {
    const swipe = gesture()
    swipe.onPointerDown(100, 100)
    swipe.onPointerMove(20, 100)
    swipe.onPointerUp()
    expect(swipe.offset()).toBe(-64)

    swipe.onPointerDown(100, 100)
    expect(swipe.onPointerUp()).toBe("reset")
    expect(swipe.offset()).toBe(0)
  })
})
