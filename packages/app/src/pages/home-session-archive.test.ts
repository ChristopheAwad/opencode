import { expect, test } from "bun:test"
import { SESSION_TABS_REMOVED_EVENT, readSessionTabsRemovedDetail } from "@/components/titlebar-session-events"
import { archiveHomeSession } from "./home-session-archive"
import type { ServerConnection } from "@/context/server"

const remote = "remote" as ServerConnection.Key

test("archiving a Home session removes its open titlebar tab", async () => {
  let detail: ReturnType<typeof readSessionTabsRemovedDetail>
  let removed = false
  window.addEventListener(
    SESSION_TABS_REMOVED_EVENT,
    (event) => {
      detail = readSessionTabsRemovedDetail(event)
    },
    { once: true },
  )

  await archiveHomeSession({
    server: remote,
    session: { id: "ses_1", directory: "/workspace" },
    archive: async () => undefined,
    remove: () => {
      removed = true
    },
  })

  expect(removed).toBe(true)
  expect(detail).toEqual({ server: remote, directory: "/workspace", sessionIDs: ["ses_1"] })
})

test("reports archive failures without removing the session", async () => {
  const failure = new Error("offline")
  let error: unknown
  let removed = false

  await archiveHomeSession({
    server: remote,
    session: { id: "ses_1", directory: "/workspace" },
    archive: async () => Promise.reject(failure),
    remove: () => {
      removed = true
    },
    onError: (value) => {
      error = value
    },
  })

  expect(error).toBe(failure)
  expect(removed).toBe(false)
})

test("coalesces duplicate archive taps into one request", async () => {
  const gate = Promise.withResolvers<void>()
  let calls = 0
  let removed = 0

  const first = archiveHomeSession({
    server: remote,
    session: { id: "ses_duplicate", directory: "/workspace" },
    archive: () => {
      calls++
      return gate.promise
    },
    remove: () => {
      removed++
    },
  })
  const second = archiveHomeSession({
    server: remote,
    session: { id: "ses_duplicate", directory: "/workspace" },
    archive: () => {
      calls++
      return gate.promise
    },
    remove: () => {
      removed++
    },
  })

  gate.resolve()
  await Promise.all([first, second])

  expect(calls).toBe(1)
  expect(removed).toBe(1)
})
