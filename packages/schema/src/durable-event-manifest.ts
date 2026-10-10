export * as DurableEventManifest from "./durable-event-manifest"

import { Schema } from "effect"
import { Event } from "./event"
import { SessionEvent } from "./session-event"
import { SessionV1 } from "./session-v1"

// V1 durable events are part of the session replay contract because the
// phone's v1 sessions replay through the current /api/session endpoints (R2).
const sessionReplayDefinitions = [
  ...SessionV1.Event.Definitions.filter((definition) => definition.durable !== undefined),
  ...SessionEvent.DurableDefinitions,
]

export const Durable = Event.durable(sessionReplayDefinitions)

export const SessionReplay = {
  definitions: Durable,
  schema: Schema.Union(sessionReplayDefinitions, { mode: "oneOf" })
    .pipe(Schema.toTaggedUnion("type"))
    .annotate({ identifier: "SessionReplayEvent" }),
} as const

export type SessionReplayEvent = typeof SessionReplay.schema.Type
