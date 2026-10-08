export type NativeBackEvent = { canGoBack: boolean }
export type NativeBackHandlers = { back: () => void; exit: () => void }

export function handleNativeBack(event: NativeBackEvent, handlers: NativeBackHandlers) {
  if (event.canGoBack) {
    handlers.back()
    return
  }
  handlers.exit()
}

type CapacitorAppPlugin = {
  addListener?: (event: "backButton", handler: (event: NativeBackEvent) => void) => { remove?: () => Promise<void> }
  exitApp?: () => void
}

export function registerNativeBackButton(
  target: unknown = globalThis,
  handlers?: NativeBackHandlers,
): (() => void) | undefined {
  const app = (target as { Capacitor?: { Plugins?: { App?: CapacitorAppPlugin } } } | undefined)?.Capacitor?.Plugins
    ?.App
  if (!app || typeof app.addListener !== "function") return undefined
  const resolved = handlers ?? {
    back: () => window.history.back(),
    exit: () => app.exitApp?.(),
  }
  const handle = app.addListener("backButton", (event) => handleNativeBack(event, resolved))
  return () => void handle?.remove?.()
}
