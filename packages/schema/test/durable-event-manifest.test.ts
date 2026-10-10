import { describe, expect, test } from "bun:test"
import { Schema } from "effect"
import { SessionReplay } from "../src/durable-event-manifest"
import { SessionEvent } from "../src/session-event"
import { SessionV1 } from "../src/session-v1"

const v1DurableKeys = [
  "session.created.1",
  "session.updated.1",
  "session.deleted.1",
  "message.updated.1",
  "message.removed.1",
  "message.part.updated.1",
  "message.part.removed.1",
]

describe("session replay manifest", () => {
  test("indexes legacy v1 durable definitions by type and version", () => {
    for (const key of v1DurableKeys) expect(SessionReplay.definitions.has(key)).toBe(true)
    expect(SessionReplay.definitions.get("session.created.1")).toBe(SessionV1.Event.Created)
    expect(SessionReplay.definitions.get("message.part.updated.1")).toBe(SessionV1.Event.PartUpdated)
  })

  test("indexes current session.next durable definitions", () => {
    expect(SessionReplay.definitions.get("session.next.agent.switched.1")).toBe(SessionEvent.AgentSwitched)
    expect(SessionReplay.definitions.get("session.next.step.ended.2")).toBe(SessionEvent.Step.Ended)
  })

  test("excludes live-only definitions from both runtimes", () => {
    for (const key of [
      "message.part.delta",
      "message.part.delta.1",
      "session.diff",
      "session.diff.1",
      "session.error",
      "session.error.1",
      "session.next.text.delta",
      "session.next.text.delta.1",
      "session.next.reasoning.delta.1",
    ])
      expect(SessionReplay.definitions.has(key)).toBe(false)
  })

  test("decodes a legacy v1 durable payload", () => {
    const removed = {
      id: "evt_legacy_removed",
      type: "message.removed",
      durable: { aggregateID: "ses_replay", seq: 4, version: 1 },
      data: { sessionID: "ses_replay", messageID: "msg_replay" },
    }

    expect(Schema.is(SessionReplay.schema)(removed)).toBe(true)
    expect(Schema.decodeUnknownSync(SessionReplay.schema)(removed)).toMatchObject({
      type: "message.removed",
      durable: { aggregateID: "ses_replay", seq: 4, version: 1 },
      data: { sessionID: "ses_replay", messageID: "msg_replay" },
    })
  })

  test("decodes a current session.next durable payload", () => {
    const switched = {
      id: "evt_next_switched",
      type: "session.next.agent.switched",
      durable: { aggregateID: "ses_replay", seq: 5, version: 1 },
      data: { timestamp: 1, sessionID: "ses_replay", messageID: "msg_replay", agent: "build" },
    }

    expect(Schema.decodeUnknownSync(SessionReplay.schema)(switched)).toMatchObject({
      type: "session.next.agent.switched",
      durable: { aggregateID: "ses_replay", seq: 5, version: 1 },
    })
  })

  test("rejects a live-only legacy payload", () => {
    const delta = {
      id: "evt_legacy_delta",
      type: "message.part.delta",
      durable: { aggregateID: "ses_replay", seq: 6, version: 1 },
      data: { sessionID: "ses_replay", messageID: "msg_replay", partID: "prt_replay", field: "text", delta: "x" },
    }

    expect(Schema.is(SessionReplay.schema)(delta)).toBe(false)
  })

  test("uses a stable identifier distinct from the current-only union", () => {
    expect(SessionReplay.schema.ast.annotations?.identifier).toBe("SessionReplayEvent")
    expect(SessionEvent.Durable.ast.annotations?.identifier).toBe("SessionDurableEvent")
  })
})
