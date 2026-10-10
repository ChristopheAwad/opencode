import { describe, expect, test } from "bun:test"
import { hapticImpact, hapticNotification } from "./native-haptics"

function plugin(record: Array<Record<string, unknown>>) {
  return {
    Capacitor: {
      Plugins: {
        Haptics: {
          impact: (input: Record<string, unknown>) => {
            record.push({ method: "impact", ...input })
          },
          notification: (input: Record<string, unknown>) => {
            record.push({ method: "notification", ...input })
          },
        },
      },
    },
  }
}

describe("native haptics", () => {
  test("maps impact styles to the Capacitor style values", () => {
    const calls: Array<Record<string, unknown>> = []
    const target = plugin(calls)

    expect(hapticImpact("light", target)).toBe(true)
    expect(hapticImpact("medium", target)).toBe(true)
    expect(hapticImpact("heavy", target)).toBe(true)

    expect(calls).toEqual([
      { method: "impact", style: "LIGHT" },
      { method: "impact", style: "MEDIUM" },
      { method: "impact", style: "HEAVY" },
    ])
  })

  test("maps notification types to the Capacitor type values", () => {
    const calls: Array<Record<string, unknown>> = []
    const target = plugin(calls)

    expect(hapticNotification("success", target)).toBe(true)
    expect(hapticNotification("warning", target)).toBe(true)
    expect(hapticNotification("error", target)).toBe(true)

    expect(calls).toEqual([
      { method: "notification", type: "SUCCESS" },
      { method: "notification", type: "WARNING" },
      { method: "notification", type: "ERROR" },
    ])
  })

  test("is a no-op without the plugin", () => {
    expect(hapticImpact("light", {})).toBe(false)
    expect(hapticImpact("light", { Capacitor: {} })).toBe(false)
    expect(hapticNotification("success", { Capacitor: { Plugins: {} } })).toBe(false)
    expect(hapticNotification("success", undefined)).toBe(false)
  })

  test("never throws when the plugin throws", () => {
    const target = {
      Capacitor: {
        Plugins: {
          Haptics: {
            impact: () => {
              throw new Error("boom")
            },
            notification: () => {
              throw new Error("boom")
            },
          },
        },
      },
    }

    expect(hapticImpact("light", target)).toBe(false)
    expect(hapticNotification("error", target)).toBe(false)
  })
})
