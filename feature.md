# R1 — opencode mobile app

Foundation is live on the phone. The next milestone is **M6b: the native-feel
mobile shell**. This file is the handoff for a fresh session; read it top to
bottom before touching code.

## Status

- R1 foundation: shipped to the branch and to the phone (see commits below).
- M6b Wave A (W1-W4): pushed in `eaf86fd88b`; phone feedback round 1 fixed
  and pushed in `b079d7c1c9`. All typechecks, unit (763), browser (46),
  session-ui (88), CORS (10), and e2e suites pass except two PRE-EXISTING
  tab-strip failures that also fail at HEAD without these changes. Second
  phone check pending. See "Wave A delivery" below.
- `project-brief.md` does not exist on any branch of this fork (checked
  `git log --all`), so reviews validate against `roadmap.md`,
  `PERSONAL-FORK.md`, `packages/app/AGENTS.md`, and the code instead. Treat
  `roadmap.md` as the product authority for this fork.
- Uncommitted local change: Android update signing fix. CI used a fresh random
  debug key on every run, so the phone rejected updates. The workflow now
  restores one stable debug keystore from the `ANDROID_DEBUG_KEYSTORE_BASE64`
  repository secret, sets `ANDROID_VERSION_CODE` from the run number, and
  verifies the APK signature. See `PERSONAL-FORK.md`. One more uninstall is
  needed to move the phone to the stable key.
- `.husky/pre-push` has a pre-existing local edit (`TURBO_CONCURRENCY=2`);
  never stage it.

## Fresh-session quickstart

1. Read this file, `roadmap.md`, `PERSONAL-FORK.md`, and
   `packages/app/AGENTS.md`.
2. Check `git status` and `git log --oneline -3`. Branch: `insecure-combined`.
3. Never commit or push without explicit user approval. The pre-push hook
   OOMs on this 5.3 GB machine; every push so far used `--no-verify` with
   explicit user approval.
4. Wave A and its phone-feedback fixes are pushed. Next: push the Android
   signing fix, then the second phone check.
5. Screenshots: `screenshots/wave-a/` (before/after, 390x844).

## What is live today

- Commits: `995e7d8757` (Android shell, connect flow, reconnect supervisor),
  `fd7b0b68e9` (CI Android SDK fix).
- Capacitor 8.5.2 Android shell in `packages/mobile/`; bundles the
  `packages/app` build; LAN `http` allowed; connect screen; reconnect
  supervisor with jittered backoff and wake signals; reconnect chip; Android
  back button; CORS for WebView origins (`packages/server/src/cors.ts`,
  regression test uncommitted).
- APK: `https://github.com/ChristopheAwad/opencode/releases/download/personal-latest/opencode-mobile-debug.apk`
  built by `.github/workflows/personal-build.yml` job `android` on every push
  to `insecure-combined`. Job `build` uploads the Linux binary first.
- Server on the user's PC: fork binary at `~/Downloads/opencode-test/opencode`,
  started as `./opencode serve --hostname 0.0.0.0 --port 4096`. After
  server-side changes, update it:
  `curl -fsSL https://raw.githubusercontent.com/ChristopheAwad/opencode/insecure-combined/install-fork | bash`
  then restart. Phone connects to `http://192.168.0.156:4096`.
- Tests delivered: `packages/app` 758 unit, 46 browser, typechecks, 11 e2e
  (`mobile-connect.spec.ts` 8, `mobile-reconnect-indicator.spec.ts` 3);
  `packages/opencode` CORS unit + HTTP tests.

## The problem M6b solves

On a phone the app renders desktop chrome. Observed on 390x844 (screenshots
in `/tmp/opencode/mobile-home.png`, `mobile-session.png`):

- Top tab strip with close buttons and a `+`, plus a corner home grid icon.
- Home is empty until a project is opened locally, even though the server has
  sessions. Projects are client-local persisted records
  (`context/server.tsx` `createServerProjects`), not fetched.
- Session view shows a full-width Session/Changes control, a title row with
  spinner and `...`, dense small tool rows, and a crowded composer.
- Desktop popovers instead of sheets; no haptics; no long-press.

Decisions already made with the user:
- Keep the WebView. The goal is native-feel chrome and interaction, not native
  rendering. Diffs, terminal, files stay free.
- All shell work is gated on `isNativeShell()`
  (`packages/app/src/utils/native-platform.ts`). Desktop and plain web must
  not change.
- The user asked for every workstream (W1-W8) but agreed to ship in waves so
  each wave is reviewable and testable on the phone.
- WebView limits are accepted: Chromium scroll/keyboard, look-alike sheets,
  no Android edge-swipe-back (system back is already wired), perf ceiling.

## M6b workstreams

### W1 — Bottom navigation + back path

- New `packages/app/src/components/mobile-nav.tsx`: fixed bottom bar with
  Sessions / Search / New / Servers and the reconnect state. Reuse:
  `home.toggle` and `tab.new` commands (`components/titlebar.tsx:317-358`)
  through `useCommand().trigger(...)`; `useTabs().newDraft(...)`
  (`context/tabs.tsx:209`; it is a context method, not a command); and the
  server picker `DialogSelectServer` / `useServerManagementController`
  (`components/dialog-select-server.tsx:178,193`).
  `components/settings-v2/servers.tsx:19` is only the settings tab panel, not
  a dialog.
- Do NOT unmount `Titlebar` on native. It owns side effects and mount points
  other components depend on: the tab-remember effect
  (`titlebar.tsx:241-257`), the `SESSION_TABS_REMOVED_EVENT` listener
  (`:259-263`), command registrations (`common.goBack`/`common.goForward`
  `:155-170`, `home.toggle` `:317-326`, `tab.new`/`tab.close`/`tab.reopenClosed`
  `:328-358`), and the `#opencode-titlebar-center` / `#opencode-titlebar-right`
  buckets where `SessionHeader` (`components/session/session-header.tsx:284-288`)
  and `pages/new-session.tsx:13` portal content. Keep `Titlebar` mounted and
  hide only its visual chrome when native (for example a `native` prop that
  still runs the effectful v2 branch and returns an empty header).
  `TabsProvider` already wraps the router root (`app.tsx:607`), so it stays.
- `packages/app/src/pages/layout-new.tsx`: when native, render `MobileNav` and
  reserve bottom space for it (padding on `main`, not on the outer route div).
  One owner for the bottom inset: `MobileNav` consumes
  `env(safe-area-inset-bottom)`; `layout-new.tsx:28-31` already pads top and
  bottom at the route level, so reconcile and do not double-pad.
- `isNativeShell()` is a boot snapshot (`entry.tsx:159`, `app.tsx:506`); it
  cannot change at runtime. Render gates may call it during setup. Tests must
  inject the Capacitor global before load (`addInitScript`), never after.
- Back path: session header back returns to the sessions list; Android back is
  already handled in `entry.tsx:160` + `utils/native-back.ts`.
- Tests: native shows nav, non-native never does (desktop and plain web);
  every nav action navigates; back from a session returns to the list;
  `Titlebar` commands still registered while its chrome is hidden (trigger
  `home.toggle`, `tab.new`); content and composer clear the nav on 390x844.

### W2 — Sessions list first, no setup

- `packages/app/src/pages/home/home-sessions-controller.tsx`: the filter is
  `buildHomeSessionRecords` (`:250-272`, filter at `:256-257`) and it uses the
  flat `session.directory` field. Add a native mode that bypasses the
  `projectDirectories` filter and falls back to the existing
  `projectForSession(...)` synthesis (`pages/layout/helpers`) for the display
  record. Do NOT read `session.location.*`: the list holds flat `Session` rows
  (`context/global-sync/home-session-index.ts:169-175` maps the V2 location to
  `directory`).
- Keep the focused-server scope (`enabled: !!home.server.focusedContext()`,
  `home-sessions-controller.tsx:62-66`) and the display cap
  (`HOME_SESSION_LIMIT = 64`, `:26,97`). The index cursor-loads everything via
  `loadHomeSessionIndex` with `HOME_V2_SESSION_PAGE_LIMIT = 5000`
  (`context/global-sync/home-session-index.ts:6,26-52`). Say the scope in the
  UI copy and test it; do not merge servers.
- Opening a row: call the existing `home.session.open(session)`
  (`home-sessions-controller.ts:181-206`). It resolves the directory, calls
  `ctx.projects.open(directory)` (`context/server.tsx:98-111`, idempotent
  against the project list, no disk check) and opens a session tab, so the
  session page and tabs work. No new open path. `openProjectNewSession`
  (`home-controller.ts:49-54`) is the draft equivalent.
- Row status: `useSessionTabAvatarState`
  (`pages/layout/project-avatar-state.ts:8-49`) returns `{ unread, loading }`;
  `SessionProgressIndicatorV2` is imported from
  `@opencode-ai/session-ui/v2/session-progress-indicator-v2` and used at
  `pages/layout/session-tab-avatar.tsx:51`. Add relative time (reuse the date
  grouping helpers in `home-sessions-controller.ts:278+`).
- Tests: zero local projects (native synthesizes rows); zero sessions; empty
  `session.directory` skips the row without throwing; very long titles
  truncate; reconnect while on the list keeps it usable; only the focused
  server's sessions appear; non-native list is unchanged.

### W3 — Compact session header

- New `packages/app/src/components/mobile-session-header.tsx` for native
  session routes: back, truncated title, running spinner, reconnect chip,
  overflow menu reusing existing session commands. It replaces only the visible
  tab strip `TitlebarTabStrip`, which lives in
  `components/titlebar-tab-strip.tsx` and is rendered by
  `components/titlebar.tsx:31,399`.
- The Session/Changes control already exists as `mobileTabs()`
  (`pages/session.tsx:2017-2051`, labels at `:2034` and `:2045`; keys
  `session.tab.session` / `session.tab.review` at `i18n/en.ts:668-669`) and is
  shown on small screens at `:2064` and `:2245` (bottom position controlled by
  `settings.general.mobileTitlebarPosition`, default `"top"`,
  `context/settings.tsx:197`). On native, move it into the compact header pill
  row or the overflow; never show it twice.
- Keep all `Titlebar` effects and mount points (see W1). `TabsInfoPopup` lives
  in `layout-new.tsx:45`, not inside `Titlebar`. `notifySessionTabsRemoved` is
  dispatched from `pages/session/timeline/message-timeline.tsx:877` and
  `pages/session/session-archive.ts:63`; its listener stays with `Titlebar`.
- i18n: reuse existing keys. Any new user-visible string needs a key in
  `i18n/en.ts` AND in all 62 locales, or the parity test
  (`i18n/parity.test.ts:99-143`) fails.
- Tests: title and status visible, back returns, overflow actions work, long
  titles truncate, RTL direction, Session/Changes control present exactly once,
  non-native unchanged.

### W4 — Composer redesign

- `packages/app/src/components/prompt-input-v2.tsx` (and `prompt-input.tsx`):
  on native, one model control (model + variant + reasoning in a compact
  bottom panel), bigger send/stop, attachments through the existing picker,
  bottom padding above `MobileNav` (one owner of the inset, see W1). Desktop
  untouched.
- W4 must not depend on W5: `mobile-sheet.tsx` is Wave B. For Wave A, build the
  model/variant panel inline from the existing `@opencode-ai/ui` dialog/drawer
  primitives; Wave B extracts the shared `mobile-sheet.tsx` and ports W4 to it.
- Tests: composer visible above the nav on 390x844; send and stop states; model
  panel opens, selects and closes; attachments picker still opens; non-native
  composer unchanged. Keyboard behavior is manual on device (M7).

### W5 — Mobile sheets

- New `packages/app/src/components/mobile-sheet.tsx` on the existing
  drawer/Dialog primitives. It generalizes the inline model panel W4 built in
  Wave A and hosts model/agent pickers, server switcher, file picker results,
  and settings entry points.
- Tests: open/close, focus trap, back closes, RTL mirroring.

### W6 — Touch targets + long-press

- New `packages/app/src/utils/long-press.ts` (pointer events, ~500 ms, move
  threshold, cancel on scroll) with unit tests for timing, cancel, release.
- Wire to session rows (archive, mark read, copy id) and tool rows (copy
  output). Raise tap sizes on native.
- Tests: long-press fires once; scroll cancels; short tap unaffected.

### W7 — Gestures + haptics

- Add `@capacitor/haptics` to `packages/mobile` and call through
  `globalThis.Capacitor.Plugins.Haptics` (same pattern as
  `utils/native-back.ts`; no `@capacitor` import in `packages/app`). Verify the
  compatible major/minor against Capacitor 8.5.2 at that time; bun
  `minimumReleaseAge` blocked the newest patch before. No-op when the plugin is
  absent; a new APK build is required.
- Android has no edge-swipe-back (system back is wired). Gestures here =
  swipe actions on session rows (archive). Edge-swipe back is an iOS item for
  R2.
- Haptics on send, stop, archive, permission approve/deny.
- Tests: swipe threshold unit tests, archive e2e, haptics no-op path.

### W8 — Timeline performance (measure first)

- `packages/app/AGENTS.md` requires a production benchmark baseline before
  session/timeline changes. Run `bun run test:stability` and one long-session
  trace (seeded 500+ message session). Record numbers here. If the machine
  OOMs, measure with a single spec only.
- Targeted fixes only: jump-to-bottom affordance, no layout jumps while
  streaming, virtualization tuning in `pages/session/timeline/`. No rewrite.

## Delivery and roadmap mapping

- Wave A = W1-W4 (R1 completion). Wave B = W5-W7, Wave C = W8 (new item R3).
- Per wave: tests first → implement → typecheck + full suites → 390x844
  screenshots before/after → diff review gate → user approval → push
  (`--no-verify`, explicitly approved) → CI builds the APK → user checks on
  the phone → update `feature.md`.
- After the phone check passes for Wave A, R1 can be marked shipped
  (date-only, direct push). R3 ships after Waves B/C.
- No push or commit without explicit user approval.

## Preview and test recipes

- Phone-size screenshot (Python Playwright is installed):
  viewport 390x844, device_scale_factor 2, `is_mobile=True`,
  `goto(..., wait_until="domcontentloaded")`, wait ~10 s (SSE keeps
  `networkidle` busy), screenshot to `/tmp/opencode`.
- Show sessions without manual setup: seed
  `localStorage["opencode.global.dat:server"] = {"list":["http://127.0.0.1:4096"],"projects":{"http://127.0.0.1:4096":[{"worktree":"/home/chris/Documents/code/opencode","expanded":true}]},"lastProject":{"http://127.0.0.1:4096":"/home/chris/Documents/code/opencode"},"recentlyClosed":{}}`
  before load. The `opencode.global.dat` prefix is real (`utils/persist.ts:28`);
  verify the value shape against `context/server.tsx` if the list stays empty.
- Exercise native branches via `addInitScript` before load (native detection is
  a boot snapshot):
  `Object.assign(window,{Capacitor:{isNativePlatform:()=>true,Plugins:{App:{addListener:()=>({remove(){}})}}}})`.
  The `Plugins.App` stub is required by `utils/native-back.ts:17-29`.
- E2E: mock at `e2e/utils/mock-server.ts`, SSE control at
  `e2e/utils/sse-transport.ts`. No `waitForTimeout` in specs
  (`e2e/AGENTS.md`).
- Commands (from package dirs, never the repo root):
  `packages/app`: `bun run typecheck`, `bun run typecheck:e2e`,
  `bun run test:unit`, `bun run test:browser`,
  `bun run test:e2e -- <spec>`, `bun run test:stability`.
  `packages/opencode`: `bun test test/server/...`.

## Known limits (accepted)

WebView scroll/keyboard are Chromium's; sheets are HTML look-alikes; no real
Android edge swipe; timeline perf has a ceiling. A true native app would need
Expo/React Native, which is out of scope. R2 (parity and resume hardening:
vendored client upgrade, per-session replay, edit/fork, subagent drill-down,
skills display, composer attachments, iOS) starts only after R3.

## Wave A delivery (uncommitted, 2026-10-08)

Implemented:
- W1: `components/mobile-nav.tsx` (Home/Search/New/Servers + reconnect chip),
  rendered by `layout-new.tsx` when native. `Titlebar` gains a `native` prop
  that hides only the header chrome (`display:none`), so commands, effects,
  and the `#opencode-titlebar-right` mount stay alive. `TabsInfoPopup` is
  hidden on native because it covered the nav at 390px.
- W2: `pages/home/home-session-records.ts` holds `buildHomeSessionRecords`;
  native mode bypasses the local-project filter, synthesizes
  `{ worktree: session.directory, expanded: true }`, and skips empty
  directories. The controller passes `isNativeShell()`; opening a row reuses
  `home.session.open`.
- W3: `components/mobile-session-header.tsx` (back, truncated title, running
  spinner, Session/Changes pills, overflow with Share/Export/Archive/New
  session). The session page renders it when native and hides the in-panel
  `mobileTabs`. Back triggers `home.toggle`.
- W4: shared `PromptInputV2` gains `native` (agent and variant controls
  hidden, toolbar `h-12`, submit 36px). The app model control opens a Dialog
  panel with the model list and reasoning options. Attachments keep the
  existing picker. `e2e/utils/mock-server.ts` gained `providerV2` serving
  `/api/provider`, `/api/model`, `/api/model/default`.

Deviations:
- W3: the reconnect chip is NOT in the session header. At 390px it squeezed
  the title to zero width. `MobileNav` shows reconnect state on every route.
- W4: the "bottom sheet" is a Dialog panel for Wave A; W5 extracts the
  shared `mobile-sheet.tsx`.
- W1: `mobile-connect.spec.ts` now asserts the nav (not the titlebar) after
  a native boot, because the titlebar chrome is hidden by design.

Test evidence (run from package directories):
- `packages/app`: `typecheck`, `typecheck:e2e` pass; unit 763 pass; browser
  46 pass; full e2e 142 pass / 2 fail. The 2 failures are
  `e2e/regression/tab-strip-mobile-scroll.spec.ts` ("keeps tabs full width",
  "two mobile tabs fill the strip"); they fail identically with Wave A
  stashed, so they are pre-existing on this branch.
- `packages/session-ui`: typecheck and 88 tests pass.
- `packages/opencode`: `cors.test.ts` + `httpapi-cors.test.ts` 10 pass.
- New e2e: mobile-nav 6, mobile-sessions 4, mobile-session-header 8,
  mobile-composer 7. New unit: home-sessions-controller 5.
- `review-terminal-stacked.spec.ts` failed once in a 2-worker run and passes
  with 1 worker; treated as machine memory pressure.

Phone feedback round 1 (2026-10-08, uncommitted fixes):
1. Project toggle did not filter: the native bypass now applies only when no
   project is selected (`native: native && !home.project.selected()`).
2. Search did not filter the visible list: on native the search box now
   filters the session list in place (single "Sessions" group) and shows the
   no-results label; the desktop dropdown is kept for non-native.
3. Agent selector was missing: restored in the native composer (variant stays
   in the model panel).
4. Model panel had no search: added "Search models" with a no-results state.
5. Reasoning options were clipped: the panel is now scrollable
   (`max-h-[70vh]`, list `max-h-[40vh]`).
6. Model name was capped at 7.5rem on phones: the native button is now
   `flex-1 max-w-none`, so the name uses the free space.
7. Agent selector still missing after the restore: the new-layout preference
   hides it unless the server has custom agents. `local.agent.visible` now
   includes `isNativeShell()`, so both the selector and
   `local.agent.current()`/`set` work on native (the earlier view-only fix
   showed the control but ignored the selection). Verified against the live
   server. The e2e mock can now inject an agent list and covers switching.
- Tests: mobile-sessions 6, mobile-composer 9; full e2e 149 pass / 2
  pre-existing fail; unit 766, browser 46, session-ui 88.

Diff review:
- Round 1 found 1 blocking issue (legacy-layout `mobileTabs` at
  `session.tsx:2273` missing the `!native` gate) plus nits. Fixed: the gate,
  a conditional Share item (`config.share === "disabled"`), and an
  empty-title fallback (`sessionTitle(...)?.trim() || ...`). Added missing
  plain-web and blank-title tests.
- Round 2: no blocking issues; one whitespace-title nit, fixed.
- Remaining follow-up (non-blocking): no native multi-server e2e proving the
  list stays focused-server-only. The scope is inherited from the existing
  query, so this is a test gap, not a behavior gap. Track for Wave B.

No timeline files changed in Wave A, so the `packages/app/AGENTS.md`
benchmark rule applies to W8 (Wave C), not here.

## M6b plan review log (2026-10-08)

Reviewer subagent, plan mode. Findings fixed in this revision:

- `project-brief.md` is absent from the whole fork, so the gate checked this
  plan against `roadmap.md`, `PERSONAL-FORK.md`, `packages/app/AGENTS.md`, and
  the code.
- W2 read `session.location.directory`; the list uses flat
  `session.directory`. Also: reuse `home.session.open`, state the
  focused-server scope, and fix the index/cap description.
- W1/W3 planned to hide `Titlebar`; that would also drop command
  registrations, the tab-remember effect, the tabs-removed listener, and the
  portal mount points used by `SessionHeader`/`new-session`. Now the plan keeps
  `Titlebar` mounted and hides only its chrome.
- `tabs.newDraft` is a context method, not a command; commands are
  `tab.new`/`tab.close`.
- Servers entry point is `DialogSelectServer`/`useServerManagementController`,
  not the settings panel `settings-v2/servers.tsx`.
- `TitlebarTabStrip` lives in `titlebar-tab-strip.tsx`.
  `SessionProgressIndicatorV2` comes from session-ui and is used by
  `session-tab-avatar.tsx`; `project-avatar-state.ts` only exposes
  `unread`/`loading`.
- W4 required the Wave B sheet (W5); now W4 builds an inline panel and W5
  generalizes it.
- `isNativeShell()` is a boot snapshot; tests inject the Capacitor global
  before load.
- i18n parity constraint and the one-owner safe-area rule were added.
- Boundary/failure tests added per workstream (empty directory, zero sessions,
  long titles, RTL, non-native unchanged, reconnect mid-navigation).

## Delivered R1 history (condensed)

- M1 plan, M2 CORS (`packages/server/src/cors.ts`, loopback no-port +
  `capacitor://localhost`), M3 reconnect supervisor
  (`utils/reconnect.ts`, wired in `context/server-sdk.tsx`, stream state and
  `retryNow`), M4 `packages/mobile` Capacitor project, M5 first-run connect
  (`components/mobile-connect.tsx`, `utils/server-probe.ts`, native entry
  branch, native "Switch server" in `ConnectionError`), M6 partial
  (reconnect chip, back button, safe areas).
- Deviations: Capacitor pinned 8.5.2 (bun `minimumReleaseAge` blocks 8.5.3);
  `usesCleartextTraffic` added by hand; no new i18n keys (parity test requires
  all 62 locales; a proper error-copy split is a follow-up); `waitForRetry`
  resolves on abort; the server-sdk state-transition unit test was omitted in
  favor of the e2e indicator spec; `bun.lock` also synced a pre-existing
  session-ui devDependency.
- Diff review rounds 1 and 2 completed for R1 foundation (round 2: no
  blocking issues).
