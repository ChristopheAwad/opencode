import { describe, expect, test, vi } from "bun:test"
import { subscribeLongPress } from "./long-press"

function pointer(type: string, init: { button?: number; clientX?: number; clientY?: number } = {}) {
  return new MouseEvent(type, { bubbles: true, cancelable: true, ...init })
}

describe("subscribeLongPress", () => {
  test("fires only after the press duration", () => {
    vi.useFakeTimers()
    try {
      const target = document.createElement("div")
      document.body.appendChild(target)
      let fired = 0
      const dispose = subscribeLongPress(target, () => fired++)

      target.dispatchEvent(pointer("pointerdown", { button: 0, clientX: 10, clientY: 10 }))
      vi.advanceTimersByTime(499)
      expect(fired).toBe(0)
      vi.advanceTimersByTime(1)
      expect(fired).toBe(1)

      dispose()
      target.remove()
    } finally {
      vi.useRealTimers()
    }
  })

  test("tolerates small movement below the threshold", () => {
    vi.useFakeTimers()
    try {
      const target = document.createElement("div")
      document.body.appendChild(target)
      let fired = 0
      const dispose = subscribeLongPress(target, () => fired++)

      target.dispatchEvent(pointer("pointerdown", { button: 0, clientX: 10, clientY: 10 }))
      target.dispatchEvent(pointer("pointermove", { clientX: 15, clientY: 12 }))
      vi.advanceTimersByTime(600)
      expect(fired).toBe(1)

      dispose()
      target.remove()
    } finally {
      vi.useRealTimers()
    }
  })

  test("cancels when movement passes the threshold", () => {
    vi.useFakeTimers()
    try {
      const target = document.createElement("div")
      document.body.appendChild(target)
      let fired = 0
      const dispose = subscribeLongPress(target, () => fired++)

      target.dispatchEvent(pointer("pointerdown", { button: 0, clientX: 10, clientY: 10 }))
      target.dispatchEvent(pointer("pointermove", { clientX: 40, clientY: 10 }))
      vi.advanceTimersByTime(600)
      expect(fired).toBe(0)

      dispose()
      target.remove()
    } finally {
      vi.useRealTimers()
    }
  })

  test("cancels on pointercancel, pointerup, and scroll", () => {
    vi.useFakeTimers()
    try {
      const target = document.createElement("div")
      document.body.appendChild(target)
      let fired = 0
      const dispose = subscribeLongPress(target, () => fired++)

      target.dispatchEvent(pointer("pointerdown", { button: 0 }))
      target.dispatchEvent(pointer("pointercancel"))
      vi.advanceTimersByTime(600)
      expect(fired).toBe(0)

      target.dispatchEvent(pointer("pointerdown", { button: 0 }))
      target.dispatchEvent(pointer("pointerup"))
      vi.advanceTimersByTime(600)
      expect(fired).toBe(0)

      target.dispatchEvent(pointer("pointerdown", { button: 0 }))
      window.dispatchEvent(new Event("scroll"))
      vi.advanceTimersByTime(600)
      expect(fired).toBe(0)

      dispose()
      target.remove()
    } finally {
      vi.useRealTimers()
    }
  })

  test("cancels on window blur and fires once per press", () => {
    vi.useFakeTimers()
    try {
      const target = document.createElement("div")
      document.body.appendChild(target)
      let fired = 0
      const dispose = subscribeLongPress(target, () => fired++)

      target.dispatchEvent(pointer("pointerdown", { button: 0 }))
      window.dispatchEvent(new Event("blur"))
      vi.advanceTimersByTime(600)
      expect(fired).toBe(0)

      target.dispatchEvent(pointer("pointerdown", { button: 0 }))
      vi.advanceTimersByTime(2000)
      expect(fired).toBe(1)

      target.dispatchEvent(pointer("pointerup"))
      target.dispatchEvent(pointer("pointerdown", { button: 0 }))
      vi.advanceTimersByTime(600)
      expect(fired).toBe(2)

      dispose()
      target.remove()
    } finally {
      vi.useRealTimers()
    }
  })

  test("dispose cancels a pending press and removes listeners", () => {
    vi.useFakeTimers()
    try {
      const target = document.createElement("div")
      document.body.appendChild(target)
      let fired = 0
      const dispose = subscribeLongPress(target, () => fired++)

      target.dispatchEvent(pointer("pointerdown", { button: 0 }))
      dispose()
      vi.advanceTimersByTime(600)
      expect(fired).toBe(0)

      target.dispatchEvent(pointer("pointerdown", { button: 0 }))
      vi.advanceTimersByTime(600)
      expect(fired).toBe(0)

      target.remove()
    } finally {
      vi.useRealTimers()
    }
  })

  test("ignores non-primary buttons", () => {
    vi.useFakeTimers()
    try {
      const target = document.createElement("div")
      document.body.appendChild(target)
      let fired = 0
      const dispose = subscribeLongPress(target, () => fired++)

      target.dispatchEvent(pointer("pointerdown", { button: 1 }))
      vi.advanceTimersByTime(600)
      expect(fired).toBe(0)

      dispose()
      target.remove()
    } finally {
      vi.useRealTimers()
    }
  })

  test("swallows the click that follows a long press", () => {
    vi.useFakeTimers()
    try {
      const target = document.createElement("div")
      document.body.appendChild(target)
      let fired = 0
      const dispose = subscribeLongPress(target, () => fired++)

      target.dispatchEvent(pointer("pointerdown", { button: 0 }))
      vi.advanceTimersByTime(500)
      target.dispatchEvent(pointer("pointerup"))
      const click = new MouseEvent("click", { bubbles: true, cancelable: true })
      target.dispatchEvent(click)
      expect(click.defaultPrevented).toBe(true)

      dispose()
      target.remove()
    } finally {
      vi.useRealTimers()
    }
  })

  test("does not swallow clicks after the swallow window", () => {
    vi.useFakeTimers()
    try {
      const target = document.createElement("div")
      document.body.appendChild(target)
      const dispose = subscribeLongPress(target, () => {})

      target.dispatchEvent(pointer("pointerdown", { button: 0 }))
      vi.advanceTimersByTime(500)
      target.dispatchEvent(pointer("pointerup"))
      vi.advanceTimersByTime(701)
      const click = new MouseEvent("click", { bubbles: true, cancelable: true })
      target.dispatchEvent(click)
      expect(click.defaultPrevented).toBe(false)

      dispose()
      target.remove()
    } finally {
      vi.useRealTimers()
    }
  })
})
