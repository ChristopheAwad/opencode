import { describe, expect, test } from "bun:test"
import { subscribeAppLifecycle, type AppLifecyclePlugin } from "./app-lifecycle"

function eventTarget() {
  const listeners = new Map<string, Set<(event: unknown) => void>>()
  return {
    addEventListener(type: string, handler: (event: unknown) => void) {
      const set = listeners.get(type) ?? new Set()
      set.add(handler)
      listeners.set(type, set)
    },
    removeEventListener(type: string, handler: (event: unknown) => void) {
      listeners.get(type)?.delete(handler)
    },
    emit(type: string, event: unknown = {}) {
      for (const handler of [...(listeners.get(type) ?? [])]) handler(event)
    },
    count(type: string) {
      return listeners.get(type)?.size ?? 0
    },
  }
}

function visibilityDoc(initial: DocumentVisibilityState = "visible") {
  const target = eventTarget()
  let state = initial
  return {
    get visibilityState() {
      return state
    },
    addEventListener: target.addEventListener,
    removeEventListener: target.removeEventListener,
    emit(type: string) {
      target.emit(type)
    },
    set(value: DocumentVisibilityState) {
      state = value
    },
    count: target.count,
  }
}

function pluginWith(input: { promise?: boolean; fail?: boolean } = {}) {
  const handles: Array<{ remove: () => void }> = []
  const calls: Array<{ event: string; callback: (state: { isActive: boolean }) => void }> = []
  const removals: string[] = []
  const plugin: AppLifecyclePlugin = {
    addListener(event, callback) {
      calls.push({ event, callback })
      const handle = { remove: () => removals.push(event) }
      handles.push(handle)
      if (input.fail) throw new Error("plugin unavailable")
      return input.promise ? Promise.resolve(handle) : handle
    },
  }
  return { plugin, calls, removals }
}

function setup(
  input: {
    plugin?: AppLifecyclePlugin
    doc?: ReturnType<typeof visibilityDoc>
    now?: () => number
    debounceMs?: number
  } = {},
) {
  const active: number[] = []
  const inactive: number[] = []
  const win = eventTarget()
  const doc = input.doc ?? visibilityDoc()
  const dispose = subscribeAppLifecycle({
    active: () => active.push(input.now?.() ?? Date.now()),
    inactive: () => inactive.push(Date.now()),
    plugin: input.plugin,
    doc: doc as unknown as Document,
    win: win as unknown as Window,
    ...(input.now ? { now: input.now } : {}),
    ...(input.debounceMs === undefined ? {} : { debounceMs: input.debounceMs }),
  })
  return { active, inactive, doc, win, dispose }
}

describe("subscribeAppLifecycle", () => {
  test("tracks visibility changes", () => {
    const ctx = setup()
    ctx.doc.set("hidden")
    ctx.doc.emit("visibilitychange")
    expect(ctx.inactive).toHaveLength(1)
    ctx.doc.set("visible")
    ctx.doc.emit("visibilitychange")
    expect(ctx.active).toHaveLength(1)
    ctx.dispose()
  })

  test("tracks capacitor app state changes", () => {
    const { plugin, calls } = pluginWith()
    const ctx = setup({ plugin })
    expect(calls.map((call) => call.event)).toEqual(["appStateChange"])
    calls[0]!.callback({ isActive: false })
    calls[0]!.callback({ isActive: true })
    expect(ctx.inactive).toHaveLength(1)
    expect(ctx.active).toHaveLength(1)
    ctx.dispose()
  })

  test("fires active on pageshow", () => {
    const ctx = setup()
    ctx.win.emit("pageshow", { persisted: false })
    expect(ctx.active).toHaveLength(1)
    ctx.dispose()
  })

  test("debounces repeated active triggers", () => {
    let now = 1_000
    const ctx = setup({ now: () => now, debounceMs: 300 })
    ctx.doc.set("visible")
    ctx.doc.emit("visibilitychange")
    ctx.doc.emit("visibilitychange")
    ctx.win.emit("pageshow", { persisted: false })
    expect(ctx.active).toHaveLength(1)
    now += 301
    ctx.doc.emit("visibilitychange")
    expect(ctx.active).toHaveLength(2)
    ctx.dispose()
  })

  test("fires active after a hide even inside the debounce window", () => {
    let now = 1_000
    const ctx = setup({ now: () => now, debounceMs: 300 })
    ctx.doc.set("visible")
    ctx.doc.emit("visibilitychange")
    ctx.doc.emit("visibilitychange")
    expect(ctx.active).toHaveLength(1)

    ctx.doc.set("hidden")
    ctx.doc.emit("visibilitychange")
    ctx.doc.set("visible")
    ctx.doc.emit("visibilitychange")
    expect(ctx.active).toHaveLength(2)
    expect(ctx.inactive).toHaveLength(1)
    ctx.dispose()
  })

  test("resolves a promise listener handle for cleanup", async () => {
    const { plugin, removals } = pluginWith({ promise: true })
    const ctx = setup({ plugin })
    ctx.dispose()
    await Promise.resolve()
    expect(removals).toEqual(["appStateChange"])
  })

  test("ignores a rejected listener handle", async () => {
    const plugin: AppLifecyclePlugin = {
      addListener: () => Promise.reject(new Error("unavailable")),
    }
    const ctx = setup({ plugin })
    ctx.doc.set("visible")
    ctx.doc.emit("visibilitychange")
    expect(ctx.active).toHaveLength(1)
    ctx.dispose()
    await Promise.resolve()
  })

  test("removes a synchronous listener handle on cleanup", () => {
    const { plugin, removals } = pluginWith()
    const ctx = setup({ plugin })
    ctx.dispose()
    expect(removals).toEqual(["appStateChange"])
  })

  test("stops forwarding events after cleanup", () => {
    const ctx = setup()
    ctx.dispose()
    ctx.doc.set("hidden")
    ctx.doc.emit("visibilitychange")
    ctx.win.emit("pageshow", { persisted: false })
    expect(ctx.inactive).toEqual([])
    expect(ctx.active).toEqual([])
    expect(ctx.doc.count("visibilitychange")).toBe(0)
    expect(ctx.win.count("pageshow")).toBe(0)
  })

  test("works without a plugin", () => {
    const ctx = setup({ plugin: undefined })
    ctx.doc.set("visible")
    ctx.doc.emit("visibilitychange")
    expect(ctx.active).toHaveLength(1)
    ctx.dispose()
  })

  test("survives a plugin that throws on registration", () => {
    const { plugin } = pluginWith({ fail: true })
    const ctx = setup({ plugin })
    ctx.doc.set("visible")
    ctx.doc.emit("visibilitychange")
    expect(ctx.active).toHaveLength(1)
    ctx.dispose()
  })
})
