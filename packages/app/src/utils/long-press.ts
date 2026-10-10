export type LongPressOptions = {
  durationMs?: number
  moveThresholdPx?: number
}

const DEFAULT_DURATION_MS = 500
const DEFAULT_MOVE_THRESHOLD_PX = 10

// Fires once per primary press after the duration while movement stays under
// the threshold. Canceled by movement, scroll, pointercancel, pointerup, blur,
// or dispose. Keep the caller's click handling separate: a fired long-press
// should suppress the following click.
export function subscribeLongPress(
  target: HTMLElement,
  onLongPress: (event: PointerEvent) => void,
  options: LongPressOptions = {},
): () => void {
  const durationMs = options.durationMs ?? DEFAULT_DURATION_MS
  const moveThresholdPx = options.moveThresholdPx ?? DEFAULT_MOVE_THRESHOLD_PX
  let timer: ReturnType<typeof setTimeout> | undefined
  let start: { x: number; y: number } | undefined
  let startEvent: PointerEvent | undefined
  let fired = false
  let swallowCleanup: (() => void) | undefined

  const clearTimer = () => {
    if (timer === undefined) return
    clearTimeout(timer)
    timer = undefined
  }
  const swallowNextClick = () => {
    if (swallowCleanup) return
    let timeout: ReturnType<typeof setTimeout> | undefined
    const cleanup = () => {
      window.removeEventListener("click", click, true)
      if (timeout !== undefined) clearTimeout(timeout)
      swallowCleanup = undefined
    }
    const click = (event: Event) => {
      event.preventDefault()
      event.stopPropagation()
      cleanup()
    }
    timeout = setTimeout(cleanup, 700)
    swallowCleanup = cleanup
    window.addEventListener("click", click, true)
  }
  const reset = () => {
    clearTimer()
    start = undefined
    startEvent = undefined
    fired = false
  }

  const onPointerDown = (event: PointerEvent) => {
    if (event.button !== 0) return
    if (event.isPrimary === false) return
    reset()
    start = { x: event.clientX, y: event.clientY }
    startEvent = event
    timer = setTimeout(() => {
      timer = undefined
      if (fired || !startEvent) return
      fired = true
      swallowNextClick()
      onLongPress(startEvent)
    }, durationMs)
  }
  const onPointerMove = (event: PointerEvent) => {
    if (!start || fired) return
    if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > moveThresholdPx) reset()
  }
  const onPointerEnd = () => reset()
  const onScroll = () => reset()
  const onBlur = () => reset()

  target.addEventListener("pointerdown", onPointerDown)
  target.addEventListener("pointermove", onPointerMove)
  target.addEventListener("pointerup", onPointerEnd)
  target.addEventListener("pointercancel", onPointerEnd)
  window.addEventListener("scroll", onScroll, { capture: true, passive: true })
  window.addEventListener("blur", onBlur)

  return () => {
    reset()
    swallowCleanup?.()
    target.removeEventListener("pointerdown", onPointerDown)
    target.removeEventListener("pointermove", onPointerMove)
    target.removeEventListener("pointerup", onPointerEnd)
    target.removeEventListener("pointercancel", onPointerEnd)
    window.removeEventListener("scroll", onScroll, { capture: true })
    window.removeEventListener("blur", onBlur)
  }
}
