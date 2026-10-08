import { describe, expect, test } from "bun:test"
import { createReconnectPolicy, defaultWakeSubscription, waitForRetry } from "./reconnect"

const sequence = (count: number, random: () => number) => {
  const policy = createReconnectPolicy({ random })
  return Array.from({ length: count }, () => policy.next())
}

describe("createReconnectPolicy", () => {
  test("starts at base, doubles, and caps", () => {
    expect(sequence(7, () => 0.5)).toEqual([500, 1000, 2000, 4000, 8000, 16000, 30000])
  })

  test("jitter stays within bounds", () => {
    expect(sequence(3, () => 0)).toEqual([400, 800, 1600])
    expect(sequence(3, () => 1)).toEqual([600, 1200, 2400])
  })

  test("jittered delays never exceed the cap", () => {
    const delays = sequence(12, () => 1)
    expect(Math.max(...delays)).toBe(30000)
  })

  test("reset returns to the base delay", () => {
    const policy = createReconnectPolicy({ random: () => 0.5 })
    policy.next()
    policy.next()
    expect(policy.attempts()).toBe(2)
    policy.reset()
    expect(policy.attempts()).toBe(0)
    expect(policy.next()).toBe(500)
  })

  test("attempts saturate without overflow", () => {
    const policy = createReconnectPolicy({ random: () => 1 })
    for (let index = 0; index < 50; index++) policy.next()
    expect(policy.attempts()).toBeGreaterThan(32)
    expect(policy.next()).toBe(30000)
  })
})

describe("waitForRetry", () => {
  test("resolves on timeout when online", async () => {
    await waitForRetry(5, { isOnline: () => true, subscribe: () => () => {} })
  })

  test("resolves on wake", async () => {
    let wake: (() => void) | undefined
    const wait = waitForRetry(60_000, {
      isOnline: () => true,
      subscribe: (onWake) => {
        wake = onWake
        return () => {}
      },
    })
    wake?.()
    await wait
  })

  test("resolves on abort and cleans up", async () => {
    let disposed = false
    const controller = new AbortController()
    const wait = waitForRetry(60_000, {
      signal: controller.signal,
      isOnline: () => true,
      subscribe: () => () => {
        disposed = true
      },
    })
    controller.abort()
    await wait
    expect(disposed).toBe(true)
  })

  test("resolves immediately when already aborted", async () => {
    const controller = new AbortController()
    controller.abort()
    await waitForRetry(60_000, { signal: controller.signal, subscribe: () => () => {} })
  })

  test("offline waits for a wake instead of the timer", async () => {
    let wake: (() => void) | undefined
    let resolved = false
    const wait = waitForRetry(1, {
      isOnline: () => false,
      subscribe: (onWake) => {
        wake = onWake
        return () => {}
      },
    }).then(() => {
      resolved = true
    })
    await new Promise((resolve) => setTimeout(resolve, 10))
    expect(resolved).toBe(false)
    wake?.()
    await wait
    expect(resolved).toBe(true)
  })

  test("does not resolve twice or after cleanup", async () => {
    let wake: (() => void) | undefined
    const controller = new AbortController()
    let count = 0
    const wait = waitForRetry(60_000, {
      signal: controller.signal,
      isOnline: () => true,
      subscribe: (onWake) => {
        wake = onWake
        return () => {
          wake = undefined
        }
      },
    }).then(() => {
      count++
    })
    controller.abort()
    await wait
    wake?.()
    await new Promise((resolve) => setTimeout(resolve, 5))
    expect(count).toBe(1)
  })
})

describe("defaultWakeSubscription", () => {
  test("wakes on online and on visible visibilitychange", () => {
    const listeners: Record<string, () => void> = {}
    const win = {
      addEventListener: (type: string, listener: () => void) => {
        listeners[type] = listener
      },
      removeEventListener: (type: string) => {
        delete listeners[type]
      },
    }
    const doc = {
      visibilityState: "hidden",
      addEventListener: (type: string, listener: () => void) => {
        listeners[`doc:${type}`] = listener
      },
      removeEventListener: (type: string) => {
        delete listeners[`doc:${type}`]
      },
    }
    let wakes = 0
    const dispose = defaultWakeSubscription(
      () => wakes++,
      doc as unknown as Document,
      win as unknown as Window,
    )

    listeners["online"]?.()
    expect(wakes).toBe(1)

    listeners["doc:visibilitychange"]?.()
    expect(wakes).toBe(1)

    doc.visibilityState = "visible"
    listeners["doc:visibilitychange"]?.()
    expect(wakes).toBe(2)

    dispose()
    expect(listeners["online"]).toBeUndefined()
    expect(listeners["doc:visibilitychange"]).toBeUndefined()
  })
})
