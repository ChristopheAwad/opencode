import { describe, expect, test } from "bun:test"
import { createStreamWatchdog } from "./stream-watchdog"

function harness(input: { isPaused?: () => boolean } = {}) {
  let now = 1_000
  let callback: (() => void) | undefined
  let tick: number | undefined
  let cleared = 0
  const fired: number[] = []
  const watchdog = createStreamWatchdog({
    staleMs: 100,
    tickMs: 10,
    isPaused: input.isPaused,
    onStale: () => fired.push(now),
    now: () => now,
    setTimer: (fn, ms) => {
      callback = fn
      tick = ms
      return 1
    },
    clearTimer: () => {
      cleared++
      callback = undefined
    },
  })
  return {
    watchdog,
    fired,
    get tick() {
      return tick
    },
    get cleared() {
      return cleared
    },
    advance(ms: number) {
      now += ms
      callback?.()
    },
    setNow(value: number) {
      now = value
    },
  }
}

describe("createStreamWatchdog", () => {
  test("arms a timer at the tick interval", () => {
    const ctx = harness()
    expect(ctx.tick).toBe(10)
    ctx.watchdog.dispose()
  })

  test("stays quiet while touched inside the stale window", () => {
    const ctx = harness()
    ctx.advance(90)
    ctx.watchdog.touch()
    ctx.advance(90)
    expect(ctx.fired).toEqual([])
    ctx.watchdog.dispose()
  })

  test("fires once after the stale window", () => {
    const ctx = harness()
    ctx.advance(100)
    expect(ctx.fired).toHaveLength(1)
    ctx.advance(1_000)
    expect(ctx.fired).toHaveLength(1)
    ctx.watchdog.dispose()
  })

  test("does not fire while paused and fires after resuming", () => {
    let paused = true
    const ctx = harness({ isPaused: () => paused })
    ctx.advance(10_000)
    expect(ctx.fired).toEqual([])
    paused = false
    ctx.advance(1)
    expect(ctx.fired).toHaveLength(1)
    ctx.watchdog.dispose()
  })

  test("dispose stops the timer", () => {
    const ctx = harness()
    ctx.watchdog.dispose()
    expect(ctx.cleared).toBe(1)
    ctx.advance(10_000)
    expect(ctx.fired).toEqual([])
  })
})
