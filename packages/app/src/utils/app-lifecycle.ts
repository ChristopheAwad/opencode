export type AppLifecyclePlugin = {
  addListener?: (event: string, callback: (state: { isActive: boolean }) => void) => unknown
}

export type AppLifecycleInput = {
  active: () => void
  inactive?: () => void
  plugin?: AppLifecyclePlugin
  doc?: Pick<Document, "visibilityState" | "addEventListener" | "removeEventListener">
  win?: Pick<Window, "addEventListener" | "removeEventListener">
  debounceMs?: number
  now?: () => number
}

// One foreground signal for all platforms: Capacitor appStateChange on native,
// document visibility plus pageshow on the web. Repeated active triggers inside
// debounceMs collapse to one call so an appStateChange + visibility pair does
// not resync twice.
export function subscribeAppLifecycle(input: AppLifecycleInput): () => void {
  const now = input.now ?? (() => Date.now())
  const doc =
    input.doc ??
    (typeof document === "undefined"
      ? undefined
      : (document as Pick<Document, "visibilityState" | "addEventListener" | "removeEventListener">))
  const win =
    input.win ??
    (typeof window === "undefined" ? undefined : (window as Pick<Window, "addEventListener" | "removeEventListener">))
  const plugin =
    input.plugin ?? (globalThis as { Capacitor?: { Plugins?: { App?: AppLifecyclePlugin } } }).Capacitor?.Plugins?.App
  const debounceMs = input.debounceMs ?? 300
  let lastActive = Number.NEGATIVE_INFINITY

  const onActive = () => {
    const at = now()
    if (at - lastActive < debounceMs) return
    lastActive = at
    input.active()
  }
  const onInactive = () => {
    // A real hide resets the debounce so the next return always fires, even
    // inside the debounce window of an earlier foreground event.
    lastActive = Number.NEGATIVE_INFINITY
    input.inactive?.()
  }
  const onVisibility = () => {
    if (doc?.visibilityState === "visible") onActive()
    else onInactive()
  }
  const onPageShow = () => onActive()

  win?.addEventListener("pageshow", onPageShow)
  doc?.addEventListener("visibilitychange", onVisibility)

  const handle = plugin?.addListener
    ? (() => {
        try {
          return plugin.addListener("appStateChange", (state) => {
            if (state.isActive) onActive()
            else onInactive()
          })
        } catch {
          return undefined
        }
      })()
    : undefined

  return () => {
    win?.removeEventListener("pageshow", onPageShow)
    doc?.removeEventListener("visibilitychange", onVisibility)
    const remove = (value: unknown) => {
      if (!value || typeof value !== "object") return
      const method = (value as { remove?: () => void }).remove
      if (typeof method === "function") method()
    }
    if (handle && typeof (handle as { then?: unknown }).then === "function")
      void Promise.resolve(handle).then(remove, () => {})
    else remove(handle)
  }
}
