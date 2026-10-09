export type StreamWatchdogInput = {
  staleMs: number
  tickMs: number
  isPaused?: () => boolean
  onStale: () => void
  now?: () => number
  setTimer?: (callback: () => void, ms: number) => unknown
  clearTimer?: (timer: unknown) => void
}

// Fires onStale at most once per arming when no touch() arrives inside staleMs.
// The consumer aborts the attempt and disposes; a fresh attempt arms a new watchdog.
export function createStreamWatchdog(input: StreamWatchdogInput) {
  const now = input.now ?? (() => Date.now())
  const setTimer = input.setTimer ?? ((callback: () => void, ms: number) => setInterval(callback, ms))
  const clearTimer = input.clearTimer ?? ((timer: unknown) => clearInterval(timer as ReturnType<typeof setInterval>))
  let lastAt = now()
  let fired = false
  let disposed = false

  const timer = setTimer(() => {
    if (disposed || fired) return
    if (input.isPaused?.()) return
    if (now() - lastAt < input.staleMs) return
    fired = true
    input.onStale()
  }, input.tickMs)

  return {
    touch() {
      lastAt = now()
    },
    dispose() {
      if (disposed) return
      disposed = true
      clearTimer(timer)
    },
  }
}
