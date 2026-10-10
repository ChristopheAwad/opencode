export type SwipeRelease = "commit" | "reveal" | "reset"

export type SwipeGestureInput = {
  width: number
  // 1 for left-to-right layouts (swipe left is toward the inline end),
  // -1 for right-to-left layouts (swipe right is toward the inline end).
  direction: 1 | -1
  revealPx?: number
  commitRatio?: number
  axisLockPx?: number
}

const DEFAULT_REVEAL_PX = 64
const DEFAULT_COMMIT_RATIO = 0.35
const DEFAULT_AXIS_LOCK_PX = 10

export function createSwipeGesture(input: SwipeGestureInput) {
  const revealPx = input.revealPx ?? DEFAULT_REVEAL_PX
  const commitAt = Math.max(revealPx, input.width * (input.commitRatio ?? DEFAULT_COMMIT_RATIO))
  const axisLockPx = input.axisLockPx ?? DEFAULT_AXIS_LOCK_PX
  let start: { x: number; y: number } | undefined
  let offset = 0
  let locked = false
  let committed = false

  const clamp = (value: number) =>
    input.direction === 1
      ? Math.max(Math.min(value, 0), -input.width)
      : Math.min(Math.max(value, 0), input.width)
  const revealOffset = () => (input.direction === 1 ? -revealPx : revealPx)
  const commitOffset = () => (input.direction === 1 ? -input.width : input.width)

  return {
    offset: () => offset,
    onPointerDown(x: number, y: number) {
      start = { x, y }
      offset = 0
      locked = false
      committed = false
    },
    onPointerMove(x: number, y: number) {
      if (!start || committed) return
      const dx = x - start.x
      const dy = y - start.y
      if (!locked) {
        if (Math.abs(dx) < axisLockPx && Math.abs(dy) < axisLockPx) return
        if (Math.abs(dy) >= Math.abs(dx)) {
          start = undefined
          offset = 0
          return
        }
        locked = true
      }
      offset = clamp(dx)
    },
    onPointerUp(): SwipeRelease {
      if (committed) return "commit"
      const magnitude = Math.abs(offset)
      if (magnitude >= commitAt) {
        committed = true
        offset = commitOffset()
        return "commit"
      }
      if (magnitude >= revealPx) {
        offset = revealOffset()
        return "reveal"
      }
      offset = 0
      return "reset"
    },
    onPointerCancel() {
      start = undefined
      locked = false
      committed = false
      offset = 0
    },
    reset() {
      start = undefined
      locked = false
      committed = false
      offset = 0
    },
  }
}
