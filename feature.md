# R1 — opencode mobile app: Android shell foundation

- Status: implemented. Full unit/browser/e2e suites pass. Diff review rounds 1 and 2 complete (round 2: no remaining blocking issues). APK builds in CI on push to `insecure-combined`; on-device validation pending. No commit yet.
- Branch: `insecure-combined` (personal fork; see `PERSONAL-FORK.md`). These files are personal and must not be merged upstream.
- Roadmap: R1 is `in progress` in `roadmap.md`.

## Goal

Ship an installable Android app that connects to the user's self-hosted opencode
server over LAN `http` (enter the PC IP), stays connected across sleep, app
switches, and network loss, and shows session status at a glance.

## Decisions already made

- Capacitor 8 Android shell. It is a managed WebView app and reuses the
  `packages/app` SolidJS UI. No React Native rewrite.
- The app bundles the `packages/app` build into the APK (`webDir` through a copy
  script), so the shell works offline and startup does not depend on the LAN.
- The app connects with `http://<pc-ip>:<port>`. Tailscale stays invisible: if
  the user is on the tailnet, they type the tailnet address instead.
- No push notifications in R1. No git/PR buttons. No iOS. No durable event
  replay (that needs a vendored client upgrade; it is R2).
- `packages/app` must not import Capacitor. Native detection goes through
  `globalThis` only, so the web bundle stays free of native code.
- The Android SDK is not installed on this machine (only Java 25). Every
  web/server milestone is verified by tests here. The APK build (M7) needs a
  one-time SDK + JDK 21 install.

## Non-goals

- Push notifications, iOS, git/PR workflow buttons, event replay cursors,
  offline API data (bundled assets still load, but live data needs the server).

## Milestones

Status: M1 [x] M2 [x] M3 [x] M4 [x] M5 [x] M6 [x] M7 [ ]

### M1 — Roadmap and plan

- `roadmap.md` created with R1 (in progress) and R2 (planned).
- `feature.md` overwritten with this plan; plan review gate completed.

### M2 — CORS for the WebView origin

Files:
- `packages/server/src/cors.ts` (current allowlist is at lines 11-20; today
  `http://localhost:` and `http://127.0.0.1:` with a port are allowed, plus
  Tauri, `*.opencode.ai`, same-host, and `opts.cors`)
- new test: `packages/opencode/test/server/cors.test.ts` — a pure unit test that
  imports `isAllowedCorsOrigin` / `isAllowedRequestOrigin` from
  `@opencode-ai/server/cors` (no Effect layer). It is distinct from the
  existing HTTP-level CORS test in `packages/opencode/test/server/`.

Change:
- Allow origin host `localhost` and `127.0.0.1` on `http` and `https` with any
  port and with **no** port. Installed WebViews report origins such as
  `https://localhost` or `https://localhost:8443`; the old exact
  `http://localhost:<port>` prefix rejects both.
- Allow `capacitor://localhost` by exact match (iOS origin; harmless now, R2
  uses it; Android uses `https://localhost`).
- Keep everything else unchanged.

Tests (written first):
- allowed: `https://localhost`, `http://localhost`, `https://localhost:8443`,
  `http://localhost:5173`, `capacitor://localhost`, `https://tauri.localhost`,
  `https://x.opencode.ai`, `undefined`, same-host via
  `isAllowedRequestOrigin`, configured `opts.cors` entry.
- rejected: `https://localhost.evil.com` (suffix attack), `https://evil.example`,
  `http://127.0.0.1.evil.com`.
- Run: `bun test test/server/cors.test.ts` from `packages/opencode`.

### M3 — Reconnect supervisor

Files:
- new: `packages/app/src/utils/reconnect.ts` — pure policy plus an interruptible
  wake helper
- new test: `packages/app/src/utils/reconnect.test.ts`
- `packages/app/src/context/server-sdk.tsx` — replace the fixed
  `RECONNECT_DELAY_MS = 250` (line 220) and `await wait(RECONNECT_DELAY_MS)`
  (line 308); expose stream state on the SDK context
- `packages/app/src/context/server-sdk.test.ts` — extend for the wake helper
- new spec: `packages/app/e2e/regression/mobile-reconnect-indicator.spec.ts`

Behavior:
- Policy: delay = `min(maxMs, baseMs * factor^attempt)` with ±`jitter`
  randomization from an injected `random`. Defaults: `baseMs=500`, `factor=2`,
  `maxMs=30_000`, `jitter=0.2`. Attempts saturate at the cap.
- Reset only after a connection stays up (the first event arrives), not after a
  failed attempt.
- While `navigator.onLine === false`, wait for a wake instead of spending
  attempts. Wake signals are `online` and `visibilitychange` → visible only:
  Capacitor APIs are not allowed in `packages/app`, so no native `resume` event.
  M7 verifies background/return behavior on the device.
- On wake, interrupt a pending wait and retry immediately. Never abort a healthy
  stream.
- Keep the existing `generation` guard, `pagehide`/`pageshow`, flush, and
  coalescing logic unchanged.
- Expose state from the SDK context: `{ state: "live" | "connecting" | "retry",
  attempt: number, nextDelayMs?: number }` and `retryNow()`.

Tests (written first):
- policy (unit, no timers): first delay uses base with jitter bounds for
  injected `random` values `0`, `0.5`, `1`; doubles per attempt; caps at
  `maxMs`; `reset()` returns to base; attempt counter saturates; jitter stays
  within bounds at the cap.
- wake helper (unit): resolves on wake event; resolves on timeout without a
  wake; cleanup prevents a late resolve (failure path); abort resolves the wait
  and cleans up (the stream loop then exits on its own guard).
- state transitions (unit, injected callbacks): connecting → live resets
  attempt; failure → retry reports attempt and next delay; `retryNow()` wakes
  the pending wait exactly once.
- e2e (event-based only; no sleeps or `waitForTimeout` per
  `packages/app/e2e/AGENTS.md`): mock server closes the stream → indicator
  appears; mock server starts answering again → indicator disappears and the
  stream is live; a second disconnect/reconnect does not create duplicate
  streams.

### M4 — Mobile package and native detection

Files:
- new: `packages/mobile/package.json` (`@opencode-ai/mobile`, private),
  `packages/mobile/capacitor.config.ts`, `packages/mobile/scripts/build-web.ts`
  (build `packages/app`, copy its `dist` into `packages/mobile/www`),
  generated `packages/mobile/android/` via `cap add android`
- new: `packages/app/src/utils/native-platform.ts` + `native-platform.test.ts`
- root `package.json` workspaces already covers `packages/*`

Config:
- `appId`: `ai.opencode.mobile` (placeholder), `appName`: `opencode`,
  `webDir`: `www`.
- Pin `androidScheme`, cleartext, and mixed-content flags against the installed
  Capacitor 8 config schema during this milestone (do not assume). The goal is
  that the WebView origin can fetch `http://<lan-ip>`; an `https://localhost`
  origin fetching `http://` needs cleartext/mixed-content permission, an
  `http://localhost` origin avoids mixed content. Record the chosen values and
  why in this file when M4 completes.
- Scripts: `build:web`, `sync` (`cap sync android`), `apk:debug`
  (`cd android && ./gradlew assembleDebug`). Gradle is not added to CI.

Tests and checks (written first):
- `native-platform.test.ts`: `isNativeShell` true for an injected target with
  `Capacitor.isNativePlatform() === true`; false when absent; false when the
  call throws (failure path); false for a plain web target.
- Web purity: `grep -rn "@capacitor" packages/app/src` returns nothing, and
  `packages/app/package.json` gains no Capacitor dependency. This replaces the
  earlier "build succeeds" claim, which proved nothing.
- `bun run build` from `packages/app` still succeeds.

### M5 — First-run connect screen

Files:
- new: `packages/app/src/components/mobile-connect.tsx`
- new: `packages/app/src/utils/server-probe.ts` + `server-probe.test.ts`
- new test: `packages/app/src/components/mobile-connect.test.ts` for the
  extracted pure validation helper
- `packages/app/src/entry.tsx` — native first-run branch
- `packages/app/src/app.tsx` — `ConnectionError` gains a native-only
  "change server" action
- `packages/app/src/components/dialog-select-server.tsx` — export `ServerForm`
  (line 113) and `useDefaultServer` (line 51); both are module-private today.
  Do not reuse `useServerPreview`; it cannot distinguish error kinds.

Entry wiring (fixed design):
- Native + no stored default server URL (`opencode.settings.dat:
  defaultServerUrl`) + no `?auth_token`/server query → do **not** build a server
  from `getCurrentUrl()` (on-device that is the WebView's own origin). Render a
  standalone tree instead:
  `PlatformProvider` → `AppBaseProviders` →
  `ServerProvider defaultServer={<sentinel key>} servers={[]}` →
  `MobileConnect`. `ServerProvider` is exported and `server.add` upserts by URL
  (`server.tsx:290-304`).
- On success: `server.add(conn)` → `useDefaultServer().setDefault(key)` → read
  the default back with `platform.getDefaultServer()` → `window.location.reload()`.
  Reload is deliberate: it re-runs the single entry path with the stored
  default, so the entry-provided servers, the persisted list, and the active
  key cannot diverge. A same-tree `setActive` would leave that split state.
- If the read-back is `null` (storage throws or is full), show
  "storage unavailable" and do not reload; otherwise the app would loop back to
  first-run forever.

Probe (`server-probe.ts`): one request, short timeout (`timeoutMs = 10_000`,
`retryCount` not used), returns
`{ kind: "healthy" } | { kind: "unauthorized" } | { kind: "unreachable" } |
{ kind: "invalid" }`:
- GET `<url>/api/health` with Basic auth when password is set.
- `200` + opencode health JSON → `healthy`; `401` → `unauthorized`;
  other 2xx/non-health JSON or unparsable body → `invalid`; abort/network →
  `unreachable`.
- `checkServerHealth` is not reused: it returns only `{healthy, version?}` and
  defaults to a 30 s timeout with 2 retries, which would hang a phone submit for
  up to a minute and cannot tell 401 from a dead host.

Validation helper (`validateMobileServerInput`):
- empty/whitespace → error; scheme-like prefix that is not `http`/`https`
  (`javascript:`, `ftp://`) → error (validate before `normalizeServerUrl`, which
  would turn `ftp://host` into `http://ftp://host`); URL with a non-root path,
  query, or hash → error; otherwise `{ ok: true, url }` after
  `normalizeServerUrl` (trims, adds `http://`, strips trailing slashes).

Tests (written first):
- validation: `""`, `"   "`, `"javascript:alert(1)"`, `"ftp://host"`,
  `"http://ip:4096/api"`, `"http://ip:4096/?x=1"` all rejected;
  `"192.168.1.5:4096"` → `http://192.168.1.5:4096`; `"http://ip:4096/"` → OK.
- probe: healthy payload; 401; connection refused; timeout (abort); 200 with an
  HTML body → invalid; all with a mocked fetch, asserting exactly one request.
- storage: `setItem` throwing keeps the form and never reloads (e2e
  `keeps the form when storage rejects the default server`); successful save
  writes both the server list entry and the default key (compare keys/shape
  with `src/context/server.test.ts` fixtures).
- browser/e2e `e2e/regression/mobile-connect.spec.ts`: inject the Capacitor
  global with Playwright `addInitScript`; extend `e2e/utils/mock-server.ts` to
  answer `/api/health` (health payload; 401 without the right Basic auth).
  Cases: fresh native load shows the form; bad URL shows an inline error and
  sends no request; unreachable shows an error; 401 shows a credentials error;
  valid URL saves and boots; seeded default URL skips the form.
- e2e re-enter path: native + one unreachable active server shows the native
  "change server" action, and using it returns to the connect screen.

### M6 — Mobile layout, status, and back button

Files (confirm current state first; keep changes minimal):
- `packages/app/src/components/titlebar.tsx` — reuse the existing
  `mobileTitlebarPosition` setting (`settings.tsx:36,197`,
  `settings-v2/general.tsx:379`, consumed at `titlebar.tsx:76`); add safe-area
  padding
- `packages/app/src/index.css` — `env(safe-area-inset-*)` (no insets exist
  today; only the `100vh` hack at lines 20-25)
- `packages/app/src/pages/layout.tsx` and `pages/layout/sidebar-items.tsx` —
  sessions access and status on small screens; the status dots already exist at
  `sidebar-items.tsx:120-140`
- reconnect indicator surface: a compact chip/banner in the new layout,
  driven by the M3 SDK context state (`live` / `connecting` / `retry` with
  `retryNow()`). `StatusPopover` and the 10 s health poll do not reflect live
  stream state, so they are not enough.
- Capacitor `App` back button: history back, exit at root (config/plugin in
  `packages/mobile`, native-side only)

Tests:
- new spec `e2e/regression/mobile-session-status.spec.ts` (small viewport):
  sessions list reachable; running spinner and attention dot visible;
  reconnect chip visible while disconnected and gone when live.
- existing desktop e2e stays green; no breakpoint regressions.
- Android back button and safe areas are checked manually in M7.

### M7 — Android build and on-device validation

Build route: GitHub Actions on push to `insecure-combined`
(`.github/workflows/personal-build.yml`, job `android`, runs after `build`):
- Temurin JDK 21; Android SDK platform 36 + build-tools 36.0.0/35.0.0;
  Gradle caches (`~/.gradle/caches`, `~/.gradle/wrapper`).
- `bun run build:web` → `bunx cap sync android` → `./gradlew --no-daemon assembleDebug`.
- Publishes `opencode-mobile-debug.apk` to the `personal-latest` release.
- The generated `packages/mobile/android/` project is committed. `www/`,
  `android/app/build/`, `local.properties`, copied web assets, and generated
  config files stay ignored and are regenerated by `cap sync`.

Local fallback (only if CI is unavailable): install Android SDK + JDK 21, then
`bun run build:web`, `bun run sync`, `bun run apk:debug`, `adb install -r ...`.

Manual checks on the phone:
- Record the real WebView origin (temporary debug log) and confirm a LAN fetch
  succeeds; then freeze the M2 CORS allowlist against the recorded value.
- First run shows the connect screen; wrong password shows an error; correct IP
  connects over LAN `http`.
- Stop the server: app retries with growing delays, no tight loop. Start it:
  app reconnects and refreshes the session list.
- Background the app for several minutes, return: stream resumes and statuses
  are correct (covers the foreground wake path).
- Send a prompt, switch apps, return: streaming output is not duplicated.
- Android back button navigates back and exits at the root.
- Safe areas: content is not under the status bar or the gesture bar.

## Implementation notes and deviations

- Capacitor pinned to 8.5.2: bun `minimumReleaseAge` (3 days) blocks 8.5.3. Bump later.
- `packages/mobile/android/app/src/main/AndroidManifest.xml` gained
  `android:usesCleartextTraffic="true"` by hand: the Capacitor 8 config did not
  emit it and Android 9+ blocks LAN `http` without it.
- Playwright e2e contract: `waitForTimeout` is forbidden, so the M3 backoff
  schedule is asserted only in unit tests (`reconnect.test.ts`); the e2e specs
  assert stream-level behavior (close → indicator → reconnect → live).
- `waitForRetry` resolves on abort instead of rejecting; the stream loop then
  exits on its own guard. Simpler and avoids an abort catch in the loop.
- i18n: no new keys were added. The parity test requires all 62 locales to have
  every English key, so the connect screen and indicator reuse
  `dialog.server.*`, `common.connect`, `command.server.switch`, and
  `app.server.*`. Error copy differs only for unreachable vs generic; proper
  distinct keys (unauthorized, invalid) are a follow-up.
- Back button uses `@capacitor/app@8.1.2` through `globalThis` only, so
  `packages/app` still has zero Capacitor imports (verified by grep).
- Validation and probe live in `packages/app/src/utils/server-probe.ts` with
  tests in `server-probe.test.ts` (plan named `mobile-connect.test.ts`).
- `mobile-session-status.spec.ts` was not created: sessions access and status
  dots already exist (new-layout home, tabs, sidebar status). The reconnect
  indicator has its own spec. Visual confirmation happens in GUI approval.
- M7 remains: push `insecure-combined`, let the `android` CI job publish
  `opencode-mobile-debug.apk`, then install it on the phone and run the manual
  checklist below, including logging the real WebView origin.
- Diff review round 1 fixed: `packages/mobile/.gitignore` used a root-relative
  pattern (now `www/`); native entry now runs the health check
  (`disableHealthCheck={!native}`) so an unreachable stored server shows
  `ConnectionError` with the native "Switch server" action; `waitForRetry`
  re-checks abort inside the executor. Round 2 found no remaining blockers.
- The planned `server-sdk` state-transition unit test was omitted: it needs
  loop-injection refactoring, and the e2e indicator spec covers the observable
  behavior. Tracked here, not silently dropped.
- `bun.lock` also syncs a pre-existing `packages/session-ui` devDependency that
  its `package.json` already declared; not part of R1.

Test evidence (all run from package directories):
- `packages/app`: `test:unit` 758 pass / 0 fail; `test:browser` 46 pass / 0 fail;
  `typecheck` and `typecheck:e2e` pass; e2e `mobile-connect.spec.ts` 8 pass,
  e2e `mobile-reconnect-indicator.spec.ts` 3 pass.
- `packages/opencode`: `cors.test.ts` 6 pass; existing `httpapi-cors*` 6 pass.
- `packages/server`: `typecheck` pass.
- `packages/mobile`: `build:web` and `cap sync android` verified; APK build not
  run (no Android SDK on this machine).

## Verification commands

- `packages/app`: `bun run typecheck`; unit
  `bun test --conditions=solid --preload ./happydom.ts ./src/<file>`;
  full `bun run test:unit`; browser tests `bun run test:browser`;
  e2e `bun run test:e2e -- <spec>`.
- `packages/opencode`: `bun test test/server/cors.test.ts`.
- `packages/mobile`: typecheck if a tsconfig exists; Gradle build only after the
  SDK install.
- Final: full unit + browser + e2e suites from `packages/app`, server CORS test
  from `packages/opencode`, then the diff review gate, then GUI approval.

## Risks and notes

- Android SDK and JDK: this machine has only Java 25 and no Android SDK.
  APK builds run in GitHub Actions (JDK 21 + SDK 36); no local install needed.
  If a local build is ever needed, it likely requires JDK 21.
- The vendored `@opencode-ai/client` 1.17.13 lacks `history`/`events`, so R1
  keeps resync-by-refetch and R2 upgrades the vendored client for replay.
- The `.husky/pre-push` local modification is pre-existing; leave it alone.
- No commit or push without explicit user approval.
