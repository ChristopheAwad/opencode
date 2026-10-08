export type ReconnectPolicy = {
  next(): number
  reset(): void
  attempts(): number
}

export function createReconnectPolicy(
  opts: { baseMs?: number; factor?: number; maxMs?: number; jitter?: number; random?: () => number } = {},
): ReconnectPolicy {
  const baseMs = opts.baseMs ?? 500
  const factor = opts.factor ?? 2
  const maxMs = opts.maxMs ?? 30_000
  const jitter = opts.jitter ?? 0.2
  const random = opts.random ?? Math.random
  let attempt = 0

  return {
    next() {
      const exponent = Math.min(attempt, 32)
      const raw = Math.min(maxMs, baseMs * factor ** exponent)
      const jittered = raw * (1 + jitter * (random() * 2 - 1))
      attempt = exponent + 1
      return Math.max(0, Math.min(maxMs, Math.round(jittered)))
    },
    reset() {
      attempt = 0
    },
    attempts() {
      return attempt
    },
  }
}

export type WakeSubscription = (onWake: () => void) => () => void

export function defaultWakeSubscription(
  onWake: () => void,
  doc: Pick<Document, "visibilityState" | "addEventListener" | "removeEventListener"> | undefined = typeof document ===
  "undefined"
    ? undefined
    : document,
  win: Pick<Window, "addEventListener" | "removeEventListener"> | undefined = typeof window === "undefined"
    ? undefined
    : window,
): () => void {
  const onOnline = () => onWake()
  const onVisibility = () => {
    if (doc?.visibilityState === "visible") onWake()
  }

  win?.addEventListener("online", onOnline)
  doc?.addEventListener("visibilitychange", onVisibility)

  return () => {
    win?.removeEventListener("online", onOnline)
    doc?.removeEventListener("visibilitychange", onVisibility)
  }
}

// Waits before the next reconnect attempt. Resolves on timeout, on a wake signal
// (network online or app foregrounded), or when the signal aborts. While the
// network reports offline the timer is skipped: retrying an unchanged condition
// only burns attempts, so the wait holds until a wake or abort arrives.
export function waitForRetry(
  ms: number,
  opts: { signal?: AbortSignal; subscribe?: WakeSubscription; isOnline?: () => boolean } = {},
): Promise<void> {
  const subscribe = opts.subscribe ?? defaultWakeSubscription
  const isOnline = opts.isOnline ?? (() => (typeof navigator === "object" ? navigator.onLine !== false : true))
  if (opts.signal?.aborted) return Promise.resolve()

  return new Promise<void>((resolve) => {
    let settled = false
    let timer: ReturnType<typeof setTimeout> | undefined
    let unsubscribe: (() => void) | undefined

    const finish = () => {
      if (settled) return
      settled = true
      if (timer !== undefined) clearTimeout(timer)
      unsubscribe?.()
      unsubscribe = undefined
      opts.signal?.removeEventListener("abort", finish)
      resolve()
    }

    if (opts.signal?.aborted) {
      finish()
      return
    }

    if (isOnline()) timer = setTimeout(finish, ms)
    unsubscribe = subscribe(finish)
    opts.signal?.addEventListener("abort", finish, { once: true })
  })
}
