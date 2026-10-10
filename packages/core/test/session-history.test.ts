import { describe, expect } from "bun:test"
import { Effect, Fiber, Layer, Schema, Stream } from "effect"
import { Database } from "@opencode-ai/core/database/database"
import { AppNodeBuilder } from "@opencode-ai/core/effect/app-node-builder"
import { LayerNode } from "@opencode-ai/core/effect/layer-node"
import { EventV2 } from "@opencode-ai/core/event"
import { Location } from "@opencode-ai/core/location"
import { ModelV2 } from "@opencode-ai/core/model"
import { ProjectV2 } from "@opencode-ai/core/project"
import { ProjectTable } from "@opencode-ai/core/project/sql"
import { ProviderV2 } from "@opencode-ai/core/provider"
import { AbsolutePath } from "@opencode-ai/core/schema"
import { SessionV2 } from "@opencode-ai/core/session"
import { SessionExecution } from "@opencode-ai/core/session/execution"
import { SessionProjector } from "@opencode-ai/core/session/projector"
import { SessionStore } from "@opencode-ai/core/session/store"
import { SessionTable } from "@opencode-ai/core/session/sql"
import { SessionV1 } from "@opencode-ai/core/v1/session"
import { testEffect } from "./lib/effect"

const projects = Layer.succeed(
  ProjectV2.Service,
  ProjectV2.Service.of({
    resolve: (directory) => Effect.succeed({ id: ProjectV2.ID.global, directory }),
    directories: () => Effect.succeed([]),
    commit: () => Effect.void,
  }),
)
const it = testEffect(
  AppNodeBuilder.build(
    LayerNode.group([Database.node, EventV2.node, SessionProjector.node, SessionStore.node, SessionV2.node]),
    [
      [ProjectV2.node, projects],
      [SessionExecution.node, SessionExecution.noopLayer],
    ],
  ),
)
const location = Location.Ref.make({ directory: AbsolutePath.make("/project") })

const GapEvent = EventV2.define({
  type: "test.session.history.gap",
  durable: { aggregate: "sessionID", version: 1 },
  schema: { sessionID: SessionV2.ID, value: Schema.String },
})

describe("SessionV2.history", () => {
  it.effect("returns an exhausted page for a migrated Session with no event sequence", () =>
    Effect.gen(function* () {
      const db = (yield* Database.Service).db
      const session = yield* SessionV2.Service
      const sessionID = SessionV2.ID.make("ses_empty_history")
      yield* db
        .insert(ProjectTable)
        .values({ id: ProjectV2.ID.global, worktree: AbsolutePath.make("/project"), sandboxes: [] })
        .onConflictDoNothing()
        .run()
      yield* db
        .insert(SessionTable)
        .values({
          id: sessionID,
          project_id: ProjectV2.ID.global,
          slug: "empty-history",
          directory: "/project",
          title: "Empty history",
          version: "test",
        })
        .run()

      const first = yield* session.history({ sessionID, limit: 10 })

      expect(first).toEqual({ events: [], hasMore: false })
    }),
  )

  it.effect("replays legacy v1 durable events published by the compatibility runtime", () =>
    Effect.gen(function* () {
      const session = yield* SessionV2.Service
      const events = yield* EventV2.Service
      const created = yield* session.create({ location })
      yield* events.publish(SessionV1.Event.MessageUpdated, {
        sessionID: created.id,
        info: {
          id: SessionV1.MessageID.make("msg_replay_user"),
          sessionID: created.id,
          role: "user",
          time: { created: 1 },
          agent: "build",
          model: { providerID: ProviderV2.ID.make("test"), modelID: ModelV2.ID.make("test") },
        },
      })
      yield* events.publish(SessionV1.Event.PartUpdated, {
        sessionID: created.id,
        part: {
          id: SessionV1.PartID.make("prt_replay_text"),
          sessionID: created.id,
          messageID: SessionV1.MessageID.make("msg_replay_user"),
          type: "text",
          text: "hello",
        },
        time: 2,
      })

      const page = yield* session.history({ sessionID: created.id, limit: 10 })

      expect(page.events.map((event) => [event.durable?.seq, event.type])).toEqual([
        [0, "session.created"],
        [1, "message.updated"],
        [2, "message.part.updated"],
      ])
      expect(page.events.map((event) => event.durable?.version)).toEqual([1, 1, 1])
      expect(page.events[1]).toMatchObject({
        data: { sessionID: created.id, info: { id: "msg_replay_user", role: "user" } },
      })
      expect(page.events[2]).toMatchObject({
        data: { sessionID: created.id, part: { id: "prt_replay_text", type: "text", text: "hello" } },
      })
      expect(page.hasMore).toBe(false)
    }),
  )

  it.effect("omits live-only legacy events from history", () =>
    Effect.gen(function* () {
      const session = yield* SessionV2.Service
      const events = yield* EventV2.Service
      const created = yield* session.create({ location })
      yield* events.publish(SessionV1.Event.PartDelta, {
        sessionID: created.id,
        messageID: SessionV1.MessageID.make("msg_replay_user"),
        partID: SessionV1.PartID.make("prt_replay_text"),
        field: "text",
        delta: "ignored",
      })

      const page = yield* session.history({ sessionID: created.id, limit: 10 })

      expect(page.events.map((event) => event.type)).toEqual(["session.created"])
    }),
  )

  it.effect("tails legacy v1 durable events after an aggregate sequence", () =>
    Effect.gen(function* () {
      const session = yield* SessionV2.Service
      const events = yield* EventV2.Service
      const created = yield* session.create({ location })
      yield* events.publish(SessionV1.Event.MessageRemoved, {
        sessionID: created.id,
        messageID: SessionV1.MessageID.make("msg_replay_removed"),
      })

      const fiber = yield* session
        .events({ sessionID: created.id, after: 0 })
        .pipe(Stream.take(2), Stream.runCollect, Effect.forkScoped)
      yield* Effect.yieldNow
      yield* events.publish(SessionV1.Event.PartDelta, {
        sessionID: created.id,
        messageID: SessionV1.MessageID.make("msg_replay_removed"),
        partID: SessionV1.PartID.make("prt_replay_removed"),
        field: "text",
        delta: "live-only",
      })
      yield* events.publish(SessionV1.Event.PartRemoved, {
        sessionID: created.id,
        messageID: SessionV1.MessageID.make("msg_replay_removed"),
        partID: SessionV1.PartID.make("prt_replay_removed"),
      })
      const streamed = Array.from(yield* Fiber.join(fiber))

      expect(streamed.map((event) => [event.durable?.seq, event.type])).toEqual([
        [1, "message.removed"],
        [2, "message.part.removed"],
      ])
    }),
  )

  it.effect("treats after as an exclusive aggregate sequence", () =>
    Effect.gen(function* () {
      const session = yield* SessionV2.Service
      const created = yield* session.create({ location })
      yield* session.switchAgent({ sessionID: created.id, agent: "one" })
      yield* session.switchAgent({ sessionID: created.id, agent: "two" })

      const page = yield* session.history({ sessionID: created.id, after: 1, limit: 10 })

      expect(page.events.map((event) => event.durable?.seq)).toEqual([2])
      expect(page.hasMore).toBe(false)
    }),
  )

  it.effect("paginates public events in aggregate order across filtered gaps without duplicates", () =>
    Effect.gen(function* () {
      const session = yield* SessionV2.Service
      const events = yield* EventV2.Service
      const created = yield* session.create({ location })
      yield* session.switchAgent({ sessionID: created.id, agent: "one" })
      yield* events.publish(GapEvent, { sessionID: created.id, value: "filtered" })
      yield* session.switchAgent({ sessionID: created.id, agent: "two" })
      yield* session.switchAgent({ sessionID: created.id, agent: "three" })

      const first = yield* session.history({ sessionID: created.id, limit: 2 })
      const after = first.events.at(-1)?.durable?.seq
      const second = yield* session.history({
        sessionID: created.id,
        after,
        limit: 2,
      })
      const sequence = [...first.events, ...second.events].map((event) => event.durable?.seq)

      expect(first.hasMore).toBe(true)
      expect(second.hasMore).toBe(false)
      expect(sequence).toEqual([0, 1, 3, 4])
      expect(new Set(sequence).size).toBe(sequence.length)
    }),
  )

  it.effect("includes events committed between pages", () =>
    Effect.gen(function* () {
      const session = yield* SessionV2.Service
      const created = yield* session.create({ location })
      yield* session.switchAgent({ sessionID: created.id, agent: "one" })
      yield* session.switchAgent({ sessionID: created.id, agent: "two" })

      const first = yield* session.history({ sessionID: created.id, limit: 1 })
      yield* session.switchAgent({ sessionID: created.id, agent: "later" })
      const second = yield* session.history({
        sessionID: created.id,
        after: first.events.at(-1)?.durable?.seq,
        limit: 10,
      })

      expect(first.hasMore).toBe(true)
      expect([...first.events, ...second.events].map((event) => event.durable?.seq)).toEqual([0, 1, 2, 3])
      expect(second.hasMore).toBe(false)
    }),
  )

  it.effect("reports exhaustion for exact-limit and limit-plus-one pages", () =>
    Effect.gen(function* () {
      const session = yield* SessionV2.Service
      const created = yield* session.create({ location })
      yield* session.switchAgent({ sessionID: created.id, agent: "one" })
      yield* session.switchAgent({ sessionID: created.id, agent: "two" })

      const exact = yield* session.history({ sessionID: created.id, after: 0, limit: 2 })
      const oneMore = yield* session.history({ sessionID: created.id, after: 0, limit: 1 })
      const exhausted = yield* session.history({
        sessionID: created.id,
        after: oneMore.events.at(-1)?.durable?.seq,
        limit: 1,
      })

      expect(exact.events).toHaveLength(2)
      expect(exact.hasMore).toBe(false)
      expect(oneMore.events).toHaveLength(1)
      expect(oneMore.hasMore).toBe(true)
      expect(exhausted.events).toHaveLength(1)
      expect(exhausted.hasMore).toBe(false)
    }),
  )

  it.effect("returns an exhausted page after the last sequence", () =>
    Effect.gen(function* () {
      const session = yield* SessionV2.Service
      const created = yield* session.create({ location })

      const page = yield* session.history({ sessionID: created.id, after: 0, limit: 10 })

      expect(page).toEqual({ events: [], hasMore: false })
    }),
  )

  it.effect("fails with NotFoundError for a missing Session", () =>
    Effect.gen(function* () {
      const session = yield* SessionV2.Service
      const error = yield* session.history({ sessionID: SessionV2.ID.make("ses_missing"), limit: 10 }).pipe(Effect.flip)

      expect(error._tag).toBe("Session.NotFoundError")
    }),
  )
})
