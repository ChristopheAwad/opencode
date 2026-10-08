import { describe, expect, test } from "bun:test"
import { isNativeShell } from "./native-platform"

describe("isNativeShell", () => {
  test("true when Capacitor reports a native platform", () => {
    expect(isNativeShell({ Capacitor: { isNativePlatform: () => true } })).toBe(true)
  })

  test("false when the global is absent", () => {
    expect(isNativeShell({})).toBe(false)
    expect(isNativeShell(undefined)).toBe(false)
    expect(isNativeShell(null)).toBe(false)
  })

  test("false when isNativePlatform is missing", () => {
    expect(isNativeShell({ Capacitor: {} })).toBe(false)
  })

  test("false when the bridge throws", () => {
    expect(
      isNativeShell({
        Capacitor: {
          isNativePlatform: () => {
            throw new Error("bridge unavailable")
          },
        },
      }),
    ).toBe(false)
  })

  test("false when the bridge returns a non-boolean", () => {
    expect(isNativeShell({ Capacitor: { isNativePlatform: () => ("yes" as unknown as boolean) } })).toBe(false)
  })
})
