# R3 — opencode mobile app: mobile shell polish (M6b Waves B and C)

This file is the handoff for the R3 work and is overwritten from the approved
plan. Read it top to bottom before touching code.

## Status

- R3: IN PROGRESS (pulled 2026-10-09). Plan review gate PASSED 2026-10-09
  (three reviewer rounds; all blocking findings fixed, final round clean).
- W5-W8 implemented on `r3-shell-polish` (commits `f72ddb0548` through
  `e71f077e67`). Diff review gate PASSED 2026-10-10 (one blocking round:
  RTL swipe direction, outside-tap reveal close, agent zero-options guard;
  all fixed, verification round found no blockers, two nits fixed).
- Final verification 2026-10-10: app `typecheck` + `typecheck:e2e` pass;
  unit 827; browser 46; session-ui 88; `test:stability` 44/44; full e2e
  201 specs with 194-195 passing. Remaining failures are the 2 pre-existing
  `tab-strip-mobile-scroll` specs plus load flakes that pass in isolation on
  this 5.3 GB machine (same pattern as the recorded baseline).
- Next: push `r3-shell-polish` with explicit user approval (`--no-verify`),
  CI builds the APK, phone check covers W5-W8, then squash-merge into
  `insecure-combined` and mark R3 shipped.
- Push `--no-verify` only with explicit approval (the pre-push hook OOMs on
  this 5.3 GB machine). Never stage `.husky/pre-push` or `screenshots/`.
- User scope decisions (2026-10-09): W5 = sheet primitive + model and agent
  pickers only. W6 = long-press opens the same actions as the mobile header
  3-dot menu (full parity) in a bottom sheet; tool-row long-press copies
  output. W7 = swipe toward inline end reveals Archive, full swipe archives,
  RTL mirrored; haptics on send/stop/archive/permission. W8 = included,
  measure first, targeted fixes only. No new i18n keys.

## W8 results (2026-10-10)

- Root cause of `adverse.spec.ts:82`: messages render in `time.created`
  order. The scenario placed the shell turn after 35 history turns, so it
  rendered at the bottom; `toBeVisible` passed offscreen and the click
  auto-scrolled to it. The row was then always in the mounted range, so the
  `toHaveCount(0)` after scrolling to the bottom could never pass. The
  state-preservation behavior itself was already correct.
- Fix: give the shell turn the oldest `created` timestamps so it renders at
  the top and is actually virtualized away and back. Test-only change; no
  product timeline code changed. One exploratory virtualizer change was
  reverted after proving it was not needed.
- `test:stability`: 44 pass / 0 fail after the fix (baseline 42 pass /
  2 fail). The `context-matrix.spec.ts:133` flake also passed this run.
- Long-session benchmark (250 turns, 30x throttle): 4/5 streaming tests hit
  the 420s per-test limit on this 5.3 GB machine; a reduced profile
  (120 turns, 4x) also times out. The review-pane benchmark passes
  (`firstReadyObservedMs` ~156 ms on open, ~89 ms per switch). No streaming
  baseline could be recorded on this machine; `test:stability` remains the
  regression gate. No targeted streaming or virtualization fix was applied
  because no evidence of a regression was available.

## W5-W7 results (worklog 2026-10-09/10)

- W5: `mobile-sheet.tsx` (corvu bottom sheet), `mobile-model-picker.tsx`,
  `mobile-agent-picker.tsx`, session-ui `agentControl` prop. Mobile sheet
  needed `closeOnOutsidePointerStrategy="pointerdown"` and always-on
  `transition-transform`, or corvu closed on the opening release.
- W6: `long-press.ts` (fires once after 500 ms, cancels on move/scroll/blur,
  swallows the release click), shared `session-actions.tsx`
  (`useSessionActions` + `SessionActionsSheet`), pure rename/delete dialogs,
  session-route hooks (`session-rename-delete.ts`), directory-aware home
  actions (`session.shareUrl`, `home-session-actions.ts`), `html[data-native]`
  CSS, tool-output long-press copy (`tool-copy.ts`).
- Home rows read from a different query client than `homeSessions.apply`
  writes to, so local row mutations are tracked in the controller
  (`sessionMutations`) instead.
- W7: `swipe-action.ts` (axis lock, reveal, commit, RTL), pointer capture on
  the row, `native-haptics.ts`, `@capacitor/haptics` 8.0.2 (lockfile +
  regenerated Gradle files), Haptics stub in the e2e native shell.
- Suites at this point: unit 826, session-ui 88, all new native e2e specs
  green (sheet 7, menu 13, tool copy 3, swipe 6, haptics 4).

## Baseline (recorded 2026-10-09, before changes)

- `packages/app`: `typecheck` and `typecheck:e2e` pass; unit 795; browser 46.
- Full e2e: 166 specs, 160 passed / 6 failed on this 5.3 GB machine. Real
  failures: the 2 pre-existing `tab-strip-mobile-scroll` specs. Load flakes
  that pass in isolation: `mobile-connect.spec.ts:102`,
  `review-line-comment.spec.ts:47`, `review-state-persistence.spec.ts:16`,
  `terminal-composer-focus.spec.ts:79`.
- `test:stability`: 42 pass / 2 failed. Real failure: `adverse.spec.ts:82`
  ("preserves an explicit shell state across virtualization"). Load flake that
  passes in isolation: `context-matrix.spec.ts:133`.
- `packages/session-ui`: typecheck and 88 tests pass.
- W8 benchmark baseline: record `BENCHMARK` numbers here before W8 code.

## W5 — mobile sheets: model + agent pickers

1. New `packages/app/src/components/mobile-sheet.tsx` on `@corvu/drawer`
   (dependency already at `packages/app/package.json:51`; the existing app
   wrapper `components/ui/drawer.tsx` hardcodes a right-side desktop drawer).
   Contract: `<MobileSheet open onOpenChange title? children>`. Implement with
   `<Drawer.Root open onOpenChange side="bottom" handleScrollableElements
   modal>` (corvu Root props; defaults relied on: `modal` true gives focus
   trap, `closeOnEscapeKeyDown`, close-on-outside-pointer), then
   `<Drawer.Portal><Drawer.Overlay/><Drawer.Content>` with `<Drawer.Label>`
   inside Content for the optional title (omit Label when no title). Content
   classes: bottom-anchored `fixed inset-x-0 bottom-0 z-[100]`, rounded top,
   drag handle `aria-hidden="true"`, `max-h-[85dvh]`, internal `overflow-y-auto`,
   `pb-[env(safe-area-inset-bottom)]`, logical insets only. Optional close
   button reuses `common.close`. `data-component="mobile-sheet"`. Native-only
   call sites.
2. New `packages/app/src/components/mobile-model-picker.tsx`: extract the
   native trigger button (`prompt-input-v2.tsx:539-580`, keep
   `data-action="prompt-model"`, `data-control-type="panel"`) and
   `NativeModelPanel` (587-666) into button + sheet. Keep
   `data-action="native-model-option"` / `native-variant-option` and
   `data-component="native-model-panel"` inside the sheet; keep
   `dialog.model.empty` for zero models. Selecting a model or variant applies
   `selection.set(..., { recent: true })` and closes the sheet. `modelControl`
   plumbing and the desktop `ModelSelectorPopoverV2` fallback are unchanged;
   the unpaid path `dialog-select-model-unpaid-v2.tsx` is unchanged.
3. Agent picker: add `agentControl?: JSX.Element` to `PromptInputV2Props`
   (`packages/session-ui/src/v2/components/prompt-input/index.tsx:38-49`;
   `JSX` is already imported at `:1`). Replace the bare `view.agent` Show
   (221-229) with:
   ```tsx
   <Show
     when={props.agentControl}
     fallback={
       <Show when={view.agent} keyed>
         {(control) => (
           <PromptInputV2ConfiguredSelect
             title={i18n.t("ui.promptInput.chooseAgent")}
             keybind={["Mod", "."]}
             control={control}
           />
         )}
       </Show>
     }
   >
     {props.agentControl}
   </Show>
   ```
   New `packages/app/src/components/mobile-agent-picker.tsx` built from
   `view.agent.options()/current()/onSelect` (`prompt-input-v2.tsx:392-401`),
   passed only when `isNativeShell()` (`prompt-input-v2.tsx:53`); renders
   nothing when there is no agent control, and the trigger hides with zero
   options. Desktop keeps the MenuV2 select.
4. Tests. Update `e2e/regression/mobile-composer.spec.ts`: panel assertions
   (currently 155-191) move from the legacy dialog scope to
   `[data-component="mobile-sheet"]`; model options keep
   `data-action="native-model-option"`; model/variant selection asserts the
   sheet closed; the agent flow (currently `menuitemradio`, 111-119) moves to
   the agent sheet buttons (`aria-pressed`). New
   `e2e/regression/mobile-sheet.spec.ts` (native 390x844, hasTouch; explicit
   `protocol: "v1"` where behavior depends on it): open/close model sheet,
   search filters, zero-model empty state, model select applies + closes,
   variant select applies, Escape closes, overlay tap closes, focus stays
   inside while open, agent sheet opens + switches agent, zero-agent composer
   hides the button, non-native composer still uses the desktop popover and
   agent MenuV2. RTL with `locale: "ar"` (pattern at
   `mobile-session-header.spec.ts:270`): assert `data-side="bottom"` and
   bounding boxes (sheet spans viewport width, rows align inline-start).

## W6 — touch targets + long-press (full 3-dot parity)

1. New `packages/app/src/utils/long-press.ts`: pointer-event long-press
   (500 ms, 10 px move threshold) fires once per press, cancels on
   move/scroll/pointercancel/blur, returns a dispose function, injectable
   timers. Unit `long-press.test.ts` (fake timers): not before duration, fires
   at duration, move cancels, pointercancel cancels, scroll cancels, dispose
   cancels, fires once, a later press can fire again.
2. Clipboard: add `"./clipboard": "./src/components/clipboard.ts"` to
   `packages/session-ui/package.json` exports and reuse `writeClipboard`
   (`packages/session-ui/src/components/clipboard.ts:1-23`) in
   `pages/session/use-session-commands.tsx` (replacing the local `write` at
   150-172) and in tool-row copy. Unit-test the shared helper behavior through
   its consumers (success, clipboard-reject fallback, total failure returns
   false). The CI insecure-origin test (`personal-build.yml:28-30`) already
   covers this file.
3. Shared actions: new `packages/app/src/components/session-actions.tsx`:
   - `useSessionActions({ sessionID, directory, client, archive, archiving,
     name })` returns header order/labels: Rename, Share (only when share is
     not disabled), Export, Archive, Delete, New session, using existing keys
     (`common.rename`, `session.share.action.share`, `common.export`,
     `common.archive`, `common.delete`, `command.session.new`).
   - Share/unshare/export logic moves from `use-session-commands.tsx`
     (`copyShare` 174-188, `share` 190-214, `unshare` 216-236,
     `exportSession` 238-261) into sessionID+directory-parameterized helpers
     (`packages/app/src/pages/session/session-share-export.ts`);
     `use-session-commands.tsx` calls them (session-route behavior unchanged;
     share/export e2e stays green).
   - New `packages/app/src/pages/home-session-actions.ts` for home rows. Home
     rows are v1 (the phone). All calls use the focused server context's raw
     workspace client `ctx.sdk.client` with explicit
     `directory: session.directory`, exactly like
     `home-sessions-controller.tsx:225-233`, behind the same
     `protocol !== "v1"` guard (`home-sessions-controller.tsx:217`). Never use
     the `api` compat layer for cross-directory calls:
     - rename: `client.session.update({ sessionID, title, directory })`
     - delete: `client.session.delete({ sessionID, directory })`, then remove
       from `ctx.sync.child(directory)`, `homeSessions().remove(id)`, evict,
       remove sub-session children found in that directory store (mirror
       `dialog-delete-session.tsx:52-91`),
       `notifySessionTabsRemoved({ directory, sessionIDs })`
     - share: if the row session has `share.url`, copy it; else
       `client.session.share({ sessionID, directory })` then copy
     - export: `fetchSessionExport` extended so `session.get`/`messages`
       receive `directory`
   - `DialogRenameSession` gains optional `directory?`, `initialTitle?`,
     `rename?`. Default behavior is exactly today's session-route behavior
     (`sdk().api.session.rename({ sessionID, title })`,
     `dialog-rename-session.tsx:21`); home passes a custom
     `rename: (title) => ctx.sdk.client.session.update({ sessionID, title,
     directory: session.directory })` plus `initialTitle` from the row. The
     optimistic `sync().session.remember` only runs when the current directory
     store has the session.
   - `DialogDeleteSession` gains optional `directory?`, `name?`,
     `deleteSession?`. Default is the current session-route logic unchanged;
     home passes its own function and name.
   - `SessionActionsSheet({ open, onOpenChange, session, ... })`: MobileSheet
     with `h-12` action rows, `data-action="session-action-rename|share|
     export|archive|delete|new"` (no collision with `home-session-archive`),
     Archive disabled while archiving.
   - Refactor `mobile-session-header.tsx:112-143` to render the same
     `useSessionActions` items in its MenuV2 (labels/order/behavior unchanged).
4. Wire long-press on both `HomeSessionRow` (`home-sessions-view.tsx:418-486`)
   and `HomeSessionSearchResultRow` (`:342-394`): row-level pointer binding
   opens `SessionActionsSheet`; short tap still opens the session; drag/move
   cancels. Native only.
5. Tap targets: set `document.documentElement` `data-native` in `entry.tsx` at
   the existing native check (159-160). Add `packages/app/src/native.css`
   imported from `index.css` with only `html[data-native]`-scoped rules,
   raising the timeline tool trigger to `min-height: 44px` (verify the exact
   attribute against `packages/session-ui/src/components/basic-tool.tsx:185-255`
   and confirm the measured box in e2e because the trigger is flex). Session
   rows get a conditional `h-12` (48 px) class; desktop/plain web stays `h-10`
   (40 px).
6. Tool-row long-press copy: in `message-timeline.tsx` bind the long-press
   util on `VirtualTimelineRow` (1119-1183; native flag at 332). On fire:
   `event.target.closest("[data-timeline-part-id]")` -> partID; find the
   `ToolPart` (`packages/sdk/js/src/v2/gen/types.gen.ts:534-547`) via
   `getMsgParts` (`message-timeline.tsx:314-315`); only
   `part.state.status === "completed"` with non-empty `part.state.output`
   copies; pending/running/error/no-output do nothing; toast
   `ui.message.copied` (exists at `packages/ui/src/i18n/en.ts:202`, merged
   into the app language context at `context/language.tsx:8`). No new keys.
7. Tests. Unit tests above. `mobile-session-menu.spec.ts` with explicit
   `protocol: "v1"` (pattern `mobile-session-header.spec.ts:127`): long-press
   opens the sheet with the same labels/order as the header menu; rename
   updates the row title; archive sends exactly one PATCH and removes the row;
   delete confirms and removes; share copies; export triggers a download;
   new-session opens a draft; short tap unaffected; drag cancels; archive
   pending disables; share-disabled hides Share; delete failure keeps the
   dialog open with the failure toast; a cross-project row acts on its own
   directory; non-native has no long-press behavior. Register
   `waitForRequest`/download waits before the action. Gesture synthesis uses
   only `page.mouse.down/up` plus web-first expects (menu visible while held);
   no `waitForTimeout`/sleeps (`e2e/AGENTS.md:11`). `mobile-tool-copy.spec.ts`:
   completed shell output copies and toasts; non-tool part and empty output do
   nothing; clipboard-failure path shows nothing; native row height >= 44 px
   and plain web 40 px.

## W7 — gestures + haptics

1. New `packages/app/src/utils/swipe-action.ts`: pure reducer; thresholds axis
   lock 10 px (also the vertical-cancel threshold), reveal 64 px, commit 35%
   of row width; phases idle -> tracking -> horizontal -> revealed -> commit;
   vertical movement cancels; release under reveal snaps back; tap elsewhere
   closes; commit fires once; direction sign read from
   `document.documentElement.dir` at gesture start (RTL mirrored); injectable
   width/dir. Unit `swipe-action.test.ts`: axis lock, vertical cancel,
   pointercancel, reveal, snap-back, commit-once, RTL sign, commit threshold
   boundary.
2. Wire to `HomeSessionRow` and search rows: shell with `touch-action: pan-y`,
   inline transform, archive affordance at the inline end with logical
   properties (`inset-inline-end`), replacing the physical `right-1.5` at
   `home-sessions-view.tsx:460` and converting the leading indicator's
   physical `right: calc(100% + 4px)` at `:191` to a logical expression.
   Reuse `data-action="home-session-archive"` (hidden today behind
   `SHOW_HOME_SESSION_ARCHIVE = false`, `:22,457-483`). Full swipe calls the
   existing archive controller (pending/disabled/coalescing intact). Row click
   is suppressed after a swipe; long-press and swipe cancel each other.
3. New `packages/app/src/utils/native-haptics.ts`: `hapticImpact("light"|
   "medium"|"heavy")`, `hapticNotification("success"|"warning"|"error")`;
   reads `globalThis.Capacitor?.Plugins?.Haptics` only; never throws; returns
   false when absent. Unit `native-haptics.test.ts`: absent, throwing plugin,
   recording plugin; no `@capacitor/*` import anywhere in `packages/app`.
4. Wire haptics behind `isNativeShell()` at each call site: send ->
   `hapticImpact("light")`, stop -> `hapticImpact("medium")`
   (`components/prompt-input-v2.tsx:408-414`); archive success ->
   `hapticNotification("success")` (`pages/session/session-archive.ts:57-92`
   and the home archive helper); permission allow -> `hapticImpact("light")`,
   reject -> `hapticImpact("medium")`
   (`pages/session/composer/session-composer-region.tsx:47-60`); swipe commit
   -> `hapticImpact("medium")`. Plain web asserts zero Haptics calls.
5. Plugin: add exact `"@capacitor/haptics": "8.0.2"` to
   `packages/mobile/package.json` (Capacitor 8 line; published 2026-03-27,
   past the 3-day `minimumReleaseAge`), `bun install` at the root,
   `bun run sync` from `packages/mobile` to regenerate the tracked
   `android/capacitor.settings.gradle` and
   `android/app/capacitor.build.gradle`. One atomic commit for
   `packages/mobile/package.json`, `bun.lock`, and both generated gradle
   files; verify the diff is haptics-only. CI re-runs sync and still verifies
   the stable APK key (`personal-build.yml:113-125`). No MainActivity change;
   never run gradle locally.
6. Tests: units above; extend `e2e/utils/mobile-shell.ts`
   `installNativeShell` with a Haptics stub recording `{method, args}` on
   `window.__capacitorHaptics`. `mobile-session-swipe.spec.ts` with explicit
   `protocol: "v1"`: reveal shows archive, tapping archive archives once,
   full swipe archives once, vertical scroll does not reveal, outside tap
   closes the reveal, RTL (`locale: "ar"`) reveals on the mirrored side.
   Haptics assertions on send, stop, archive, permission allow and reject;
   web no-op. A new APK is required for on-device haptics.

## W8 — timeline performance (measure first)

1. Before any W8 code, with the perf config's production build
   (`e2e/performance/playwright.config.ts` builds and serves): record
   `bun run test:stability` (expect 43 pass / 1 `adverse.spec.ts:82` fail) and
   `TIMELINE_HISTORY_TURNS=250 TIMELINE_CPU_THROTTLE=30 TIMELINE_DELTA_COUNT=160
   bunx playwright test --config e2e/performance/playwright.config.ts
   timeline/session-timeline-benchmark.spec.ts`, plus a 390x844 trace with
   `OPENCODE_PERFORMANCE_TRACE_DIR`. Record the BENCHMARK numbers here.
2. Fix `adverse.spec.ts:82` "preserves an explicit shell state across
   virtualization" first: investigate the `toolOpen` store
   (`message-timeline.tsx:90,411,916-917`, cache eviction 542-546) and the
   virtualizer remount; add unit coverage for state retention across
   eviction/remount and make the existing scenario pass. No rewrite.
3. Only evidence-backed fixes from this pre-approved list, each with unit
   tests and a `test:stability` comparison (`packages/app/AGENTS.md:4`):
   projection hot path (`getMsgPart` linear finds at
   `message-timeline.tsx:315,867,896,1128`; per-delta projection rebuild
   `projection.ts:32-46`); streaming anchoring
   (`packages/ui/src/hooks/create-auto-scroll.tsx:172-205`,
   `maybeAnchorBottom` 522-540, `resizeItem` 457-495); virtualization tuning
   (`renderOverscan` 412,511-520, `scrollToFn` 425-429). Stop rule: if the
   trace shows no actionable hotspot, ship only the adverse fix and record the
   evidence.
4. Jump-to-bottom: verify on the phone; only adjust
   `packages/app/src/pages/session.tsx:1521-1531` if needed, and any change is
   gated by `isNativeShell()` so desktop is untouched. Run `test:stability`
   after W6 (hit-area changes affect `timelineFallbackItemSize`/measurements,
   `message-timeline.tsx:89-90,545`) and after W7.

## Verification and shipping

- Tests first per workstream. From `packages/app`: `typecheck`,
  `typecheck:e2e`, `test:unit`, `test:browser`, full `test:e2e`,
  `test:stability`, plus the perf commands above. From `packages/session-ui`:
  `typecheck`, `test`. Compare against the baseline; the only accepted
  pre-existing failures are the 2 `tab-strip-mobile-scroll` specs and, until
  W8 fixes it, `adverse.spec.ts:82`.
- Diff review gate (reviewer subagent) on `git diff
  insecure-combined...r3-shell-polish`; fix blockers; rerun only on the fixes.
- Push with explicit approval (`git push --no-verify origin r3-shell-polish`
  first if needed, then the approved merge push); CI builds the APK; user
  phone-checks W5-W8 (sheets, long-press menu parity, tool copy, swipe
  archive, haptics, tap sizes, jump-to-bottom, RTL sanity).
- After phone approval: `git merge --squash r3-shell-polish` into
  `insecure-combined`, delete the branch, mark R3 shipped in `roadmap.md`,
  update this file.

## Risks

- Corvu drawer drag vs inner list scroll -> `handleScrollableElements`, test
  on the phone.
- Long-press vs swipe vs click on one row -> shared cancel/axis-lock unit
  tests.
- session-ui `agentControl` optional prop -> session-ui tests; desktop
  fallback unchanged.
- Haptics needs a new APK; the plugin manifest adds VIBRATE; no-op elsewhere.
- Header menu refactor -> `mobile-session-header.spec.ts` extended for parity.
- `bun run sync` regenerates gradle files -> atomic haptics-only commit; CI
  signature check unchanged.
- Cross-directory home actions -> e2e asserts per-row directory requests.
- W8 regressions -> stability suite + unit tests gate every change; no
  rewrite.

## Plan review log (2026-10-09)

- Round 1: 8 blocking findings (stale archive path; home-route share/export/
  rename/delete context; R4 #8 double-claim; native CSS gating; branch
  strategy; haptics guards; clipboard helper; empty/boundary tests; RTL;
  sheet contract; gesture e2e waits; W8 gates; composer spec drift). All
  fixed.
- Round 2: 9 blocking findings (corvu Root props; stale create-auto-scroll
  path; return of `ui.message.copied`; clipboard duplication; rename API
  surface; dialog reuse; agentControl JSX; tool-output lookup; R4 amendment
  wording). All fixed.
- Round 3: 2 blocking findings (rename contradiction; explicit v1 protocol in
  new specs). Fixed, then approved with no blockers and no nits.
