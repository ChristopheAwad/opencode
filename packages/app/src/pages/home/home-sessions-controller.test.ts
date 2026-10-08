import { describe, expect, test } from "bun:test"
import type { Session } from "@opencode-ai/sdk/v2/client"
import type { LocalProject } from "@/context/layout"
import { buildHomeSessionRecords } from "./home-session-records"

const session = (input: Partial<Session> & Pick<Session, "id" | "directory">) =>
  ({
    title: "",
    version: "v2",
    projectID: "project",
    time: { created: 0, updated: 0 },
    ...input,
  }) as Session

const project = (worktree: string): LocalProject => ({ worktree, expanded: true })

function records(input: { sessions: Session[]; projects?: LocalProject[]; native?: boolean }) {
  const projects = input.projects ?? []
  return buildHomeSessionRecords({
    sessions: () => input.sessions,
    projectDirectories: () => projects.flatMap((item) => [item.worktree, ...(item.sandboxes ?? [])]),
    projects: () => projects,
    projectByID: () => new Map(projects.flatMap((item) => (item.id ? [[item.id, item] as const] : []))),
    native: input.native ?? false,
  })
}

describe("buildHomeSessionRecords", () => {
  test("keeps only sessions in locally opened projects without native mode", () => {
    const result = records({
      sessions: [
        session({ id: "local", directory: "/workspace/a", time: { created: 0, updated: 1 } }),
        session({ id: "remote", directory: "/workspace/b", time: { created: 0, updated: 2 } }),
      ],
      projects: [project("/workspace/a")],
    })

    expect(result.map((record) => record.session.id)).toEqual(["local"])
  })

  test("includes every server session in native mode and synthesizes a project", () => {
    const result = records({
      native: true,
      sessions: [
        session({ id: "older", directory: "/workspace/a", time: { created: 0, updated: 1 } }),
        session({ id: "newer", directory: "/workspace/b", time: { created: 0, updated: 2 } }),
      ],
      projects: [],
    })

    expect(result.map((record) => record.session.id)).toEqual(["newer", "older"])
    expect(result[0]?.project.worktree).toBe("/workspace/b")
    expect(result[0]?.projectName).not.toBe("")
  })

  test("prefers a matching local project in native mode", () => {
    const local = project("/workspace/a")
    const result = records({
      native: true,
      sessions: [session({ id: "local", directory: "/workspace/a" })],
      projects: [local],
    })

    expect(result).toHaveLength(1)
    expect(result[0]?.project).toBe(local)
  })

  test("skips sessions without a directory in native mode", () => {
    const result = records({
      native: true,
      sessions: [
        session({ id: "empty", directory: "" }),
        session({ id: "valid", directory: "/workspace/a" }),
      ],
      projects: [],
    })

    expect(result.map((record) => record.session.id)).toEqual(["valid"])
  })

  test("returns no records for an empty list in either mode", () => {
    expect(records({ sessions: [] })).toEqual([])
    expect(records({ sessions: [], native: true })).toEqual([])
  })
})
