import type { Session } from "@opencode-ai/sdk/v2/client"

// Returns the session and all of its descendants so a delete removes nested
// sub-sessions from the directory store, mirroring the session-route dialog.
export function collectSessionRemovalIDs(sessions: Session[], sessionID: string): Set<string> {
  const removed = new Set<string>([sessionID])
  const byParent = new Map<string, string[]>()
  for (const item of sessions) {
    const parentID = item.parentID
    if (!parentID) continue
    const existing = byParent.get(parentID)
    if (existing) {
      existing.push(item.id)
      continue
    }
    byParent.set(parentID, [item.id])
  }

  const stack = [sessionID]
  while (stack.length) {
    const parentID = stack.pop()
    if (!parentID) continue

    const children = byParent.get(parentID)
    if (!children) continue

    for (const child of children) {
      if (removed.has(child)) continue
      removed.add(child)
      stack.push(child)
    }
  }

  return removed
}
