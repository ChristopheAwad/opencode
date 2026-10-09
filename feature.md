# R5 — opencode mobile app: sync hardening

This file is the handoff for the R5 work and is overwritten from the approved
plan. Read it top to bottom before touching code.

## Status

- R5: IN PROGRESS. Roadmap order is now R5 → R3 → R4 → R2.
- Plan review gate PASSED 2026-10-09 (three reviewer rounds; 7 blocking
  findings fixed, then 2 remaining blockers fixed, then approved).
- Stability baseline recorded 2026-10-09 BEFORE code changes: `test:stability`
  43 pass / 1 pre-existing `adverse.spec.ts:82` fail. Re-run and compare after.
- R1 is shipped and phone-verified. The session-header bug batch (#11/#15/#16)
  is closed and phone-verified (`f2ccdee37d` through `7e02890d0e`).
- `project-brief.md` does not exist on any branch of this fork. Reviews
  validate against `roadmap.md`, `PERSONAL-FORK.md`, `packages/app/AGENTS.md`,
  `packages/app/e2e/AGENTS.md`, and the code.
- Never commit or push without explicit user approval. Do not stage
  `.husky/pre-push` (pre-existing local `TURBO_CONCURRENCY=2` edit).
- No server or protocol changes in R5. No new i18n keys (62-locale parity
  test fails otherwise).

## Results (2026-10-09, uncommitted)

- Implemented tests-first for S1-S4, then the code.
- `packages/app`: `typecheck`, `typecheck:e2e` pass; unit 795 (baseline 763,
  +32 new); browser 46; full e2e 164 pass with only the 2 pre-existing
  `tab-strip-mobile-scroll` failures on the final run (two earlier runs had one
  intermittent flaky spec each, `mobile-connect.spec.ts:76` and
  `session-todo-dock-navigation.spec.ts:26`, both passing in isolation on this
  5.3 GB machine); new specs `mobile-foreground-resync` 3,
  `mobile-pending-feedback` 3 pass.
- `packages/session-ui`: typecheck and 88 tests pass.
- `test:stability`: 43 pass / 1 pre-existing `adverse.spec.ts:82`, identical
  to the pre-change baseline (rerun after the review fixes).
- oxlint on the changed files: no new errors (the one reported error is the
  pre-existing `pageMessages` assertion in the smoke spec, unchanged by R5).
- E2E harness fixes required by the new reconnect catch-up: the raw
  `mockOpenCodeServer` SSE body ends immediately, which made the app reconnect
  in a loop (harmless before, churny now). `sse-transport.ts` now emulates the
  server's 10s heartbeat without recording acknowledgements, and the two specs
  that never installed the transport (`smoke/session-timeline.spec.ts`,
  `regression/session-timeline-context-resize.spec.ts`) now install it; the
  resize spec also sends its transition events through the transport instead of
  relying on a reconnect to replay them.
- One behavior nuance found in e2e: the lifecycle debounce now resets on
  `inactive`, so a real hide/return always fires even inside 300ms.
- Diff review fixes (2026-10-09): home-list archive now coalesces duplicate
  taps in `archiveHomeSession` (unit-tested) with a controller pending store
  and a disabled/pending row button (the row button is behind
  `SHOW_HOME_SESSION_ARCHIVE = false`, so the visible path is the header);
  per-session archiving set in `session-archive.ts`; rejected listener-handle
  promise handled; `server.connected` catch-up shares the 1s resync debounce;
  `wasHidden` resets when a resync runs; the submit guard sits after the
  empty-input abort branch per plan; resize spec sends events only through the
  transport; native jump uses `.tap()`; pending spans are `aria-hidden`.
- Deviations kept: shell/command sends stay fire-and-forget (input clears
  synchronously, so a second tap is empty), so `submitting` releases after
  dispatch for those modes; the v2 keyboard guard is covered by e2e, no
  session-ui unit test file was added; `event.restart` stays exposed for
  future use.
- Diff review gate PASSED 2026-10-09 (two rounds: one blocking home-archive
  item plus nits, all fixed; verification round found no blockers). Commit
  hygiene: never stage `.husky/pre-push` or `screenshots/`.

## Goal

After background, disconnect, or slow network, the phone shows current data,
recovers a dead stream, closes message gaps with no visible hole, and shows
pending feedback with no duplicate actions. App-side only, no server update.

## Why (research findings)

- The phone detects protocol v1 (`utils/server-protocol.ts:24-34`; fork
  `/global/health` returns `{healthy:true}`), so it runs legacy sessions.
- Legacy durable events (`session.created/updated/deleted`,
  `message.updated/removed`, `message.part.updated/removed`) are stored with
  seqs (`schema/src/v1/session.ts:571-630`), but the R2 replay endpoints
  (`GET /api/session/:id/history`, `/event?after=`) filter to
  `session.next.*` (`core/src/session.ts:346-359`). Replay returns nothing for
  the phone's sessions. Durable replay is deferred to R2 and needs server or
  protocol work first; this finding is recorded in `roadmap.md`.
- `message.part.delta` is live-only. Snapshot refetch plus paging is the only
  app-side way to recover missed state, hence gap closing.

## Existing behavior (verified)

- Stream loop `context/server-sdk.tsx` start 287-353; for-await 310-326; sync
  envelopes skipped 318; catch 327-335; backoff+retry 341-344; stop 355-359;
  pagehide->stop / pageshow persisted-only->start 361-364.
- v1 heartbeat `server.heartbeat` is a data frame every 10s
  (`opencode/src/server/routes/instance/httpapi/handlers/global.ts:35-38`).
  v2 heartbeat is an SSE comment the generated client drops
  (`server/src/handlers/event.ts:37`).
- Resync plumbing: `context/server-sync.tsx` global listener 531-573;
  `server.connected` refetches home index on second connect, bootstrap, and
  queues active directories 546-571; no message-level refresh. Query defaults
  disable focus/reconnect refetch (`app.tsx:283-290`).
- Sessions `context/server-session.ts`: `sync` 836-848, `loadMessages`
  733-834 (touched/reconcile race protection), `history.loadMore` 1402-1405,
  `pin/unpin` 1413-1420, page sizes 20/200 at lines 30-31, `meta.limit` is a
  loaded-message count (726). Routed session pins in `pages/directory-layout.tsx:56-57`;
  timeline mount force-refreshes cached sessions stale after 15s
  (`pages/session/timeline/model.ts:25-39`).
- Lifecycle: no `appStateChange` anywhere. `@capacitor/app` 8.1.2
  (`packages/mobile/package.json:14`). Plugin pattern in
  `utils/native-back.ts:12-29`; real `addListener` returns a Promise handle.
- Pending gaps: new-session send awaits `worktree.create`/`session.create`
  before optimistic state (`components/prompt-input/submit.ts:362-416`), no
  re-entrancy guard (318-336); v2 composer has no guard
  (`session-ui/src/v2/components/prompt-input/interaction.ts:330-335,360-363`);
  archive has no pending (`pages/home/home-sessions-controller.tsx:208-238`,
  view 456-478); delete dialog has no pending guard
  (`components/dialog-delete-session.tsx:94-97,112-114,131`).

## Design

### S1. Stream liveness watchdog

- New `utils/stream-watchdog.ts`: `createStreamWatchdog({ staleMs, tickMs,
  isPaused, onStale, now?, setTimer?, clearTimer? })`. `touch()` resets the
  deadline; one interval; fires `onStale` once per arming; `dispose()`
  clears; paused while `isPaused()`.
- `server-sdk.tsx` in `start()`: per attempt arm watchdog (stale 35_000, tick
  5_000; 35s = three missed 10s heartbeats). Pause: `!appActive ||
  document.visibilityState === "hidden"`. `touch()` immediately after
  `for await (...)` before the legacy/sync branch at 317-318, so heartbeat and
  sync frames reset the deadline. Dispose in `finally`.
- v1 only, with a code comment: v2 heartbeats are comments (no frames) and
  the app's v2 path is unreachable against this server (detector returns v1).
  A future v2 activation must switch to byte-activity monitoring.
- Track `lastFrameAt` (every frame) and `hiddenAt` (lifecycle inactive).
  `restart()` is exposed on `ServerSDKBase.event` (used internally by
  `ensureLiveAfterForeground`). `restart()` = `stop(); void start()`;
  `stop()` sets `started=false`, bumps `generation`, aborts; `start()` flips
  `started=true`, waits the previous run, returns the new run.
- `ensureLiveAfterForeground()`: if `!started` -> `start()`; else if
  `!wasHidden` -> return; else if `stream().state !== "live"` or
  `lastFrameAt <= hiddenAt` -> `restart()`. Used by pageshow, app-active, and
  visibility-active. Replaces the persisted-only pageshow branch.
  `shouldRestartAfterForeground({ live, lastFrameAt, hiddenAt })` is the
  exported pure decision used by the unit tests.

### S2. Foreground lifecycle and resync

- New `utils/app-lifecycle.ts`: `subscribeAppLifecycle({ active, inactive,
  plugin?, doc?, win?, debounceMs = 300, now? })`. Registers Capacitor
  `appStateChange` (Promise handle resolved for cleanup; tolerate sync handle
  and a rejected handle), document `visibilitychange`, and window `pageshow`
  for web. Debounces duplicate active triggers (300ms covers the
  appStateChange + visibilitychange pair); an `inactive` event resets the
  debounce so a real hide/return always fires. Missing plugin is a no-op.
- `server-sdk.tsx` onMount: register lifecycle for stream concerns
  (inactive -> `hiddenAt`, appActive false; active -> appActive true +
  `ensureLiveAfterForeground()`).
- `server-sync.tsx` onMount: register lifecycle for data. On active, and on
  `server.connected` when `connectedCount > 1`, and on `global.disposed`, run
  one single-flight `resync()`:
  `activeSessionsQuery.refetch()`, `homeSessions.refresh("server.connected")`,
  `bootstrap.refetch()`, `queue.push(key)` for each active child,
  `session.markStale()`, `void session.catchUpMany(session.pinnedIDs())`.
  A `lastResyncAt` check skips runs within 1000ms (reconnect bursts).

### S3. Catch-up with gap closing (no visible hole)

- `server-session.ts`: add `stale` Set (cleared by `evict`). `markStale()`
  adds every loaded key; bounded by the 40-session cache. Pinned sessions
  catch up immediately; all other stale sessions catch up lazily when their
  next `sync` runs, which is when they become visible.
- One per-session inflight map shared by `sync` and `catchUp`:
  - `sync` keeps `runInflight(inflight, id, ...)` (existing coalescing tests
    at `server-session.test.ts:687-716` must stay green). `sync` on a stale
    session routes to catch-up.
  - `catchUp(id)` chains after the current entry: `previous = inflight.get(id)
    ?? resolved`, `run = previous.catch(() => {}).then(() => load(id,
    { force: true }, { gapClose: true }))`, set map entry, clean up when
    settled and still current. A plain sync during catch-up joins the
    catch-up promise (superset). A catch-up during a plain sync waits, then
    runs, so the gap always closes.
- `gapClose`: capture previous newest message id (list ascending via
  `compareMessages`). Run forced page 50 (`meta.limit` is a loaded count, not
  a page preference). If the captured id is present, done. Else loop
  `loadMessages(id, 200, meta.cursor[id], "prepend")` at most 10 times
  (about 2000 messages), checking after each pass; stop on overlap,
  `meta.complete`, or `!history.more`. On bound miss, clear stale and leave
  the remainder to normal scroll paging. Clear stale in `finally`, including
  on error/404, so a deleted session cannot loop.
- `catchUpMany(ids)` uses `Promise.allSettled` so one failure cannot drop the
  rest. `pinnedIDs()` returns `[...pinned.keys()]`.
- Catch-up uses message list paging through `fetchMessages`, not the deferred
  R2 replay endpoints.

### S4. Pending feedback and double-action guards

- `submit.ts`: `submitting` signal. Order in `handleSubmit`: `preventDefault`;
  compute the empty-input case; the empty+working abort branch stays before
  the guard; then `if (submitting()) return; setSubmitting(true)`; the whole
  remainder in `try { ... } finally { setSubmitting(false) }`.
- Hold the guard until the non-queued follow-up send settles (the
  `sendFollowupDraft` promise) and until the queue path returns. The
  optimistic add still runs synchronously, so UI feedback is immediate.
  Two rapid follow-ups produce one message ID and one request; two rapid
  submits while busy still queue both.
- `prompt-input.tsx` submit button 1578-1589: disabled while submitting,
  spinner instead of the send icon, existing labels kept, spinner
  `aria-hidden`.
- v2: pending threaded through `prompt-input-v2.tsx:408-413` into session-ui
  `PromptInput` (button `index.tsx:676-719`); `canSubmit` 330-335 and the
  keyboard `submit()` 360-363 both check it. Optional prop, default false,
  desktop unchanged.
- Archive: pending store in `home-sessions-controller.tsx`; set -> try ->
  `finally` clear; the `protocol !== "v1"` early return sits inside the try.
  Same shape in `pages/session/session-archive.ts:42-71`; the mobile header
  archive command (`mobile-session-header.tsx:117`) is disabled while pending.
- `dialog-delete-session.tsx`: `deleting` signal with re-entry guard. Close
  only on success; on failure keep the dialog open, reset pending, keep the
  existing toast. Both v1/v2 dialog buttons disabled with a spinner.

## Test plan (tests first)

Unit (`packages/app/src`, bun test, injectable clocks, no wall-clock waits):
- `utils/stream-watchdog.test.ts`: touch resets; stale fires once; paused
  while hidden; dispose clears.
- `utils/app-lifecycle.test.ts`: active/inactive from Capacitor and
  visibility; debounce coalesces; Promise handle cleanup and sync handle;
  missing plugin no-op.
- `context/server-session.test.ts`: catch-up closes a gap by paging until
  overlap; stops on complete/no-more/bound; one force load when the refetched
  page already overlaps; stale sync routes to catch-up; stale cleared on
  success and on error/404; batch isolation; concurrent catch-up coalesces;
  catch-up waits for an in-flight sync then closes the gap; plain sync during
  catch-up joins and does not double load; duplicate sync coalescing
  unchanged.
- `components/prompt-input/submit.test.ts`: pending true during gated create,
  reset after and on error; double new-session submit ignored; double
  follow-up produces one message ID/request; queue path accepts both; empty
  abort path unchanged; adjust un-awaited double-submit tests to await.
- session-ui: interaction pending blocks submit and disables the button.

E2E (`packages/app/e2e`, no wall-clock waits):
- Extend `utils/mobile-shell.ts` `installNativeShell` to record Capacitor
  listeners for `appStateChange`/`pause`/`resume` and expose an emitter.
- New `regression/mobile-foreground-resync.spec.ts` with `protocol: "v1"`:
  (a) open session, close SSE, add messages to the mock, emit inactive then
  active, assert new connection via `waitForConnection({after})`, refreshed
  request counters, and the new messages rendered; (b) half-open (connection
  open, no frames) emit inactive/active, assert a new connection id;
  (c) plain web dispatches `visibilitychange` with overridden
  `visibilityState`; (d) non-native chrome unchanged.
- New `regression/mobile-pending-feedback.spec.ts`: deferred `page.route` for
  session create, archive, delete. Native taps use `.tap()`. Double tap
  asserts exactly one request. Delete failure keeps the dialog open.
- Update `context/server-sdk.test.ts` pageshow expectations.

Commands (from package dirs):
- `packages/app`: `bun run typecheck`, `bun run typecheck:e2e`,
  `bun run test:unit`, `bun run test:browser`,
  `bun run test:e2e -- <spec>`, full e2e, `bun run test:stability`.
- `packages/session-ui`: `bun run typecheck`, `bun run test`.
- Known pre-existing failures to compare against: 2 `tab-strip-mobile-scroll`
  e2e specs; 1 stability `adverse.spec.ts:82`.

## Implementation order

1. Tests first for S1-S4 (above).
2. S1 watchdog + server-sdk.
3. S2 lifecycle + server-sync resync.
4. S3 catch-up.
5. S4 pending feedback.
6. Full verification, then diff review gate, then phone check.

## Risks and mitigations

- Double resync on native: 300ms debounce.
- Timer throttling while hidden: watchdog paused; hidden-to-active restart.
- Catch-up runaway: shared inflight map, 10-page bound, per-session errors
  isolated.
- Fetch vs live event race: existing touched/reconcile protection
  (`server-session.test.ts:1242+`).
- No new locale strings; desktop non-native unchanged.
- Watchdog timer behavior is unit-tested only; E2E covers the lifecycle
  restart path (no 35s waits).

## Plan review log (2026-10-09)

- Round 1: 7 blocking issues. Fixed: catchUp race and page-size semantics;
  stale scope and deleted-session failure; v2 watchdog scope; resync storms;
  pending leaks on early returns; roadmap double-claim of #6/#17; e2e strength
  (.tap, request counts, new-connection assertions).
- Round 2: 2 blockers remained. Fixed: shared per-session inflight map for
  sync+catchUp chaining; follow-up guard held until the send settles.
- Round 3: approved, no blockers.
