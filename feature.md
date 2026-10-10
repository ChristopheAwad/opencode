# R2 slice — widen durable replay to v1 sessions

This file is the handoff for the R2 replay slice and is overwritten from the
approved plan. Read it top to bottom before touching code.

## Status

- R2: IN PROGRESS. The server replay widening slice shipped 2026-10-10
  (squash-merged into `insecure-combined`). R2 stays `in progress`: the
  vendored `@opencode-ai/client` upgrade and app-side replay consumption
  remain follow-up R2 work.
- R3 shipped 2026-10-10 (squash `57ca9f6c8b`, CI run `38017451055`, phone
  check passed); `roadmap.md` holds the durable R3 record. R3 and this slice
  ran in parallel; the user asked for parallel work and the global AGENTS.md
  allows it.
- Slice branch `r2-replay-v1` lived in a separate git worktree
  (`/home/chris/Documents/code/opencode-r2`), branched from `insecure-combined`.
  This deliberately diverged from `PERSONAL-FORK.md:28-36`'s dev-based flow:
  of `feature.md`, `roadmap.md`, `PERSONAL-FORK.md`, and `AGENTS.md`, only
  `AGENTS.md` exists on `dev`; `dev` (`0112a92c`) is an ancestor of
  `insecure-combined` (`3577ecd9f7`); and the slice files are identical between
  the two branches (the only shared-package diff is `packages/server/src/cors.ts`
  plus `packages/opencode` UI/CORS test files, none touched by this slice).
- `feature.md` disposition: this file is the R2 slice handoff. The R3 worktree
  kept its own copy; the only merge conflict was this file, resolved to this
  record. `roadmap.md` keeps both records.
- Acceptance is server-test-only. Zero phone behavior change: the phone stays
  v1 and never calls `/api/session/:id/history` or `.../event` until the
  vendored client upgrade adds call sites (`packages/app/src/context/server-sdk.tsx:316-328`,
  `packages/app/src/utils/server-compat.ts`;
  `packages/app/src/context/server-session.ts:550-594` stays on legacy
  `client.session.messages` for `protocol === "v1"`).
- No R3 file overlap: this slice touches `packages/schema`, `packages/core`,
  `packages/protocol`, `packages/server`, `packages/opencode`, `packages/client`,
  and `packages/sdk/js` only.
- Plan review gate PASSED 2026-10-09 (three reviewer rounds: 6 blockers fixed,
  then 2, final round clean with 2 wording nits fixed).

## Baseline (recorded 2026-10-09, before code changes)

- `packages/schema`: `bun test` -> 13 pass / 2 fail, both pre-existing
  `event-manifest.test.ts` (count drift 55 vs 58; `Definitions.slice(40,43)`
  order drift). Not caused by this slice.
- `packages/core`: `bun test test/session-history.test.ts` -> 6 pass.
- `packages/protocol`: `bun test` -> 2 pass.
- `packages/opencode`: `bun test test/server/httpapi-session.test.ts` -> 21
  pass / 0 fail.
- `packages/client`: `bun run check:generated` -> clean (exit 0), generated
  files unchanged.
- Fresh worktree setup: `bun install --ignore-scripts` (the full install fails
  on the `tree-sitter-powershell` native build; the main worktree has no
  compiled binary either, and the slice does not need it).

## Results (2026-10-09, branch `r2-replay-v1`)

- Commits: `8fc5c9ee34` (schema + test), `3f4746e223` (core + tests),
  `aa52a31186` (protocol + server/sdk-next tests), `18dddc0ed6` (regenerated
  client, legacy SDK, `packages/sdk/openapi.json`).
- Implementation: `SessionReplay` in `packages/schema/src/durable-event-manifest.ts`
  (definitions = `Durable`; tagged union identifier `SessionReplayEvent`);
  `SessionV2.history`/`events` use it (`packages/core/src/session.ts`);
  both `/api/session/:id/history` and `.../event` success schemas use it
  (`packages/protocol/src/groups/session.ts`).
- Test results after the change:
  - `packages/schema`: `bun test` -> 20 pass / 2 fail (same pre-existing
    `event-manifest.test.ts` failures); `bun typecheck` clean. New
    `durable-event-manifest.test.ts`: 7 pass.
  - `packages/core`: full `bun test` -> 1105 pass / 0 fail; `bun typecheck`
    clean. `session-history.test.ts` 10 pass (4 new tests: v1 replay, live-only
    omission, historical+live tail, after-end exhaustion); `session-create.test.ts`
    updated for the now-visible `session.created` seq 0; `session-prompt.test.ts`
    unchanged as predicted.
  - `packages/protocol`: `bun test` 2 pass; `bun typecheck` clean.
  - `packages/server`: `bun typecheck` clean (no test script).
  - `packages/client`: `bun run check:generated` green on the committed tree;
    `bun typecheck` clean; `bun test` 16 pass. Mocked-fetch history/events tests
    needed no change.
  - `packages/opencode`: `bun typecheck` clean; `bun test test/server/httpapi-session.test.ts`
    -> 22 pass (new legacy replay test incl. `limit=0`, `limit=101`, `after=abc`
    -> 400); `bun run test:httpapi` -> 208 pass / 0 fail.
  - `packages/sdk-next`: `bun typecheck` clean; `test/embedded.test.ts` ->
    1 pass / 3 fail, all pre-existing (SQLite `SQLITE_CANTOPEN` opening temp
    databases; verified identical on the stashed base). The updated stream uses
    `after: 0` so its `session.next.model.switched` expectation stays valid.
- Generated artifacts: `bun run generate` (client), `bun ./packages/sdk/js/script/build.ts`,
  `bun dev generate > ../sdk/openapi.json`; prettier reports all generated files
  unchanged. `packages/codemode/test/fixtures/opencode-v2-openapi.json` left
  pinned.

## Problem (reviewer-verified)

- Handlers `packages/server/src/handlers/session.ts:332-364` delegate to
  `SessionV2.Service`.
- `history` uses `EventV2.readAggregate` with `manifest: SessionDurable`
  (`packages/core/src/session.ts:352-359`; the manifest at
  `packages/schema/src/durable-event-manifest.ts:7-10` only carries
  `SessionEvent.DurableDefinitions` = `session.next.*`). `events` filters with
  `Schema.is(SessionEvent.Durable)` (`packages/core/src/session.ts:195,346-351`).
- The legacy v1 runtime publishes v1 durable events through `EventV2Bridge`
  (`packages/opencode/src/event-v2-bridge.ts:19-33`; publishers at
  `packages/opencode/src/session/session.ts:535,622,631,637,746,857,869`) into
  `EventTable` (`packages/core/src/event.ts:316-348`); v1 durable definitions
  are at `packages/schema/src/v1/session.ts:502-630`.
- The global `Durable` manifest already includes v1 durable definitions
  (`packages/schema/src/durable-event-manifest.ts:12-15`, 35 keys);
  `EventV2.readAggregate` and `EventV2.durable` already decode them. Only the
  session replay manifest, the live filter, and the protocol schemas are narrow.

## Waiver (schema V1-event policy)

`packages/schema/AGENTS.md` bars V1-only events from the current Protocol
surface "unless a current-client requirement is documented". The requirement is
documented in `roadmap.md:29-30` (phone replay catch-up). Add a short comment in
`durable-event-manifest.ts` citing it. No protocol-exclusion test exists to
update; `packages/schema/test/v1-isolation.test.ts:18-27` stays green because
`durable-event-manifest.ts` imports the `./session-v1` compat entrypoint
(allowed), not `./v1/`.

## Changes

1. `packages/schema/src/durable-event-manifest.ts`:
   - `sessionReplayDefinitions = [...SessionV1.Event.Definitions.filter((d) => d.durable !== undefined), ...SessionEvent.DurableDefinitions]`
   - Keep `export const Durable = Event.durable(sessionReplayDefinitions)`
     (content unchanged).
   - Replace `SessionDurable` with:
     ```ts
     export const SessionReplay = {
       definitions: Durable,
       schema: Schema.Union(sessionReplayDefinitions, { mode: "oneOf" })
         .pipe(Schema.toTaggedUnion("type"))
         .annotate({ identifier: "SessionReplayEvent" }),
     } as const
     export type SessionReplayEvent = typeof SessionReplay.schema.Type
     ```
   - Generated artifact churn `SessionDurableEvent` -> `SessionReplayEvent` is
     expected and regenerated below.
2. `packages/core/src/session.ts`: use `SessionReplay` / `SessionReplayEvent`
   in the `events` and `history` signatures and the live filter.
3. `packages/protocol/src/groups/session.ts:311,332`: use
   `SessionReplay.schema`; update both descriptions to say replay covers
   `session.next.*` and legacy v1 durable events.
4. Regeneration (required): `bun run generate` in `packages/client`;
   `./script/generate.ts` from the repo root (regenerates
   `packages/sdk/js/src/v2/gen/types.gen.ts` and `packages/sdk/openapi.json`);
   inspect `git status`.
   `packages/codemode/test/fixtures/opencode-v2-openapi.json` stays pinned
   unless a test fails.

## Tests (write first)

1. New `packages/schema/test/durable-event-manifest.test.ts`:
   - definitions contain the 7 v1 durable versioned keys (`session.created.1`,
     `session.updated.1`, `session.deleted.1`, `message.updated.1`,
     `message.removed.1`, `message.part.updated.1`, `message.part.removed.1`)
     and the `session.next.*` keys including `session.next.step.ended.2`.
   - definitions exclude v1 live-only types (`message.part.delta`,
     `session.diff`, `session.error`) and `session.next.text.delta`.
   - `Schema.is(SessionReplay.schema)` is true for a decoded v1
     `message.part.updated` payload and a `session.next.step.ended` payload;
     false for `message.part.delta`.
   - decode a full v1 payload with `durable.version === 1`.
2. `packages/core/test/session-history.test.ts` (update + add):
   - `SessionV2.create` publishes `SessionV1.Event.Created` at seq 0
     (`packages/core/src/session.ts:241-242`), now visible. Update sequence
     expectations: paginate first page `[0,1]`, second `[3,4]` (the test-only
     `GapEvent` at seq 2 stays filtered); includes-between-pages `[0]` then
     `[1,2,3]`; reposition the exhaustion test with `after: 0`.
   - New: publish `SessionV1.Event.MessageUpdated` and
     `SessionV1.Event.PartUpdated` via `EventV2.Service`; `history` returns
     them with `durable.version === 1` and intact data.
   - New: `history` excludes a published live-only `SessionV1.Event.PartDelta`.
   - New: `events({ after })` yields historical and newly published v1 durable
     events, and never a live-only v1 event.
   - New boundary: `after` at/after the last seq -> empty page, `hasMore` false.
3. Update affected expectations (reviewer-found):
   - `packages/core/test/session-create.test.ts:193-209` (test "omits legacy
     creation rows from the V2 Session event stream"): rewrite to the new
     contract (created visible, live-only omitted).
   - `packages/core/test/session-create.test.ts:325-337` and `:353-370`: the
     first event is now `session.created` at seq 0 (`take(2)` or `after: 0`).
   - `packages/sdk-next/test/embedded.test.ts:55-57,91`: expect
     `session.created` at seq 0 (or stream with `after: 0`).
   - `packages/core/test/session-prompt.test.ts:186-213`: verify-only; the
     setup inserts the Session row directly with no created event, so the
     `[0,1,2,3]` prompt seqs are expected to stay unchanged.
   - `packages/client/test/effect.test.ts:133-139,189` and
     `promise.test.ts:131-137,200` are mocked-fetch tests: verify-only, expected
     to need no change (the widened union still decodes `session.next.*`).
4. Extend `packages/opencode/test/server/httpapi-session.test.ts`: create a
   session through the legacy `Session` service, update a message/part, then
   `GET /api/session/:id/history` and assert v1 durable events (matching
   aggregateID, `durable.version === 1`), absence of `message.part.delta`, and
   keep the missing-session 404. Add query boundaries `limit=0`, `limit=101`,
   and non-numeric `after` -> 400 (`SessionHistoryLimit` at
   `packages/protocol/src/groups/session.ts:87-92`; `after=-1` is already
   covered at `packages/opencode/test/server/httpapi-exercise/index.ts:1096-1103`).
5. `packages/client`: `bun run check:generated` green.

## Verification and shipping

- Commands after the change:
  - `packages/schema`: `bun typecheck`, `bun test`
  - `packages/core`: `bun typecheck`, `bun test test/session-history.test.ts test/event.test.ts test/session-create.test.ts test/session-prompt.test.ts`
  - `packages/protocol`: `bun typecheck`, `bun test`
  - `packages/server`: `bun typecheck`, `bun test`
  - `packages/client`: `bun run generate`, `bun run check:generated`, `bun typecheck`, `bun test`
  - `packages/opencode`: `bun typecheck`, `bun test test/server/httpapi-session.test.ts`
  - `packages/sdk-next`: `bun typecheck`, `bun test test/embedded.test.ts`
- Accepted pre-existing failure: `packages/schema` `event-manifest.test.ts`
  (2 tests). Must not grow.
- Diff review gate (reviewer subagent) on
  `git diff insecure-combined...r2-replay-v1`; fix blockers; rerun only on the
  fixes.
- After tests and diff review pass: wait for the user's explicit approval, then
  `git merge --squash r2-replay-v1` into `insecure-combined`, delete the branch.
  R2 stays `in progress`; add a shipped-slice line to R2 scope and extend R2
  `Files` (`packages/schema`, `packages/core`, `packages/protocol`,
  `packages/server`, `packages/opencode`, `packages/sdk/js`,
  `packages/sdk/openapi.json`). Keep R3's shipped roadmap entry if R3 merged
  first.
- No phone check (server-only change); CI builds as usual after the merge.

## Risks

- Widening a public protocol union: no in-repo consumer of `history`/`events`
  today; generated artifacts are regenerated in the same change.
- Historical sessions predating the durable bridge replay partially; replay is
  catch-up, not full history (the R2 client design owns that boundary).
- Pre-existing `packages/schema` test failures must not count as regressions.

## Plan review log (2026-10-09)

- Round 1: 6 blocking findings (dual in-progress/feature.md handling; branch
  base vs PERSONAL-FORK; schema V1-event waiver; phone reachability stated;
  regeneration scope; missed existing test expectations) plus nits. All fixed.
- Round 2: 2 blocking findings (local `dev` exists; parallel + feature.md
  disposition unstated). Fixed with verified facts.
- Round 3: no blockers; 2 wording nits fixed.

## Diff review log (2026-10-09)

- Round 1 (fresh reviewer, `git diff insecure-combined...r2-replay-v1`): no
  blockers. 3 nits: stale `event is SessionEvent.DurableEvent` filter
  predicate; missing `data` assertions in the core and server replay tests;
  no live-only event published during the tail test. All fixed locally without
  a rerun (commit `52a5bd7540`); targeted tests and typecheck re-run green.
