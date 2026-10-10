import { describe, expect, test } from "bun:test"
import type { Session } from "@opencode-ai/sdk/v2/client"
import { collectSessionRemovalIDs } from "./home-session-actions"

function session(id: string, parentID?: string): Session {
  return {
    id,
    slug: id,
    projectID: "project",
    directory: "/tmp/project",
    title: id,
    version: "dev",
    time: { created: 0, updated: 0 },
    parentID,
  }
}

describe("collectSessionRemovalIDs", () => {
  test("returns only the session when it has no children", () => {
    const ids = collectSessionRemovalIDs([session("a"), session("b")], "a")
    expect([...ids]).toEqual(["a"])
  })

  test("collects nested descendants", () => {
    const sessions = [session("root"), session("child", "root"), session("grandchild", "child"), session("other")]
    const ids = collectSessionRemovalIDs(sessions, "root")
    expect([...ids].sort()).toEqual(["child", "grandchild", "root"])
  })

  test("ignores children of other parents", () => {
    const sessions = [session("root"), session("sibling"), session("nephew", "sibling")]
    const ids = collectSessionRemovalIDs(sessions, "root")
    expect([...ids]).toEqual(["root"])
  })

  test("handles an empty session list", () => {
    const ids = collectSessionRemovalIDs([], "missing")
    expect([...ids]).toEqual(["missing"])
  })

  test("does not loop on duplicate parent entries", () => {
    const sessions = [session("root"), session("child", "root"), session("child", "root")]
    const ids = collectSessionRemovalIDs(sessions, "root")
    expect([...ids].sort()).toEqual(["child", "root"])
  })
})
