import { describe, expect, test } from "bun:test"
import { handleNativeBack, registerNativeBackButton } from "./native-back"

describe("handleNativeBack", () => {
  test("navigates back when webview history exists", () => {
    const calls: string[] = []
    handleNativeBack({ canGoBack: true }, { back: () => calls.push("back"), exit: () => calls.push("exit") })
    expect(calls).toEqual(["back"])
  })

  test("exits at the root", () => {
    const calls: string[] = []
    handleNativeBack({ canGoBack: false }, { back: () => calls.push("back"), exit: () => calls.push("exit") })
    expect(calls).toEqual(["exit"])
  })
})

describe("registerNativeBackButton", () => {
  test("returns undefined without the native plugin", () => {
    expect(registerNativeBackButton({})).toBeUndefined()
    expect(registerNativeBackButton(undefined)).toBeUndefined()
    expect(registerNativeBackButton({ Capacitor: { Plugins: {} } })).toBeUndefined()
  })

  test("wires the backButton listener and forwards events", () => {
    const calls: string[] = []
    let listener: ((event: { canGoBack: boolean }) => void) | undefined
    let removed = false
    const target = {
      Capacitor: {
        Plugins: {
          App: {
            addListener: (event: string, handler: (event: { canGoBack: boolean }) => void) => {
              expect(event).toBe("backButton")
              listener = handler
              return { remove: () => Promise.resolve((removed = true)) }
            },
          },
        },
      },
    }
    const dispose = registerNativeBackButton(target, { back: () => calls.push("back"), exit: () => calls.push("exit") })
    listener?.({ canGoBack: false })
    expect(calls).toEqual(["exit"])
    dispose?.()
    expect(removed).toBe(true)
  })
})
