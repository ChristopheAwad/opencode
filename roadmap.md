# Roadmap

Permanent items for this personal fork. IDs never change. Never renumber or delete an ID.

Status values: `planned`, `in progress`, `shipped YYYY-MM-DD (PR #N)`, `scrapped (reason)`.

Tiers: 1 = small fix, 2 = feature, 3 = strategic work that is not planned until pulled.

## R1 — opencode mobile app: Android shell foundation

- Status: shipped 2026-10-08
- Tier: 2
- Effort: L
- Depends on: none
- Files: `packages/mobile/` (new), `packages/app/src/entry.tsx`, `packages/app/src/utils/` (new helpers), `packages/app/src/context/server-sdk.tsx`, `packages/app/src/pages/`, `packages/app/src/components/`, `packages/server/src/cors.ts`, `packages/opencode/test/server/`, `.github/workflows/personal-build.yml` (android job)
- Goal: an installable Android app that connects to a self-hosted opencode server over LAN `http` (enter IP, optional password), resumes reliably after sleep and network loss, and shows session status at a glance.
- Shipped: Capacitor Android shell, CI APK with stable signing, first-run connect screen, reconnect supervisor and chip, Android back button, CORS for WebView origins (commits `995e7d8757`, `fd7b0b68e9`), and M6b Wave A with its phone-feedback fixes (commits `eaf86fd88b` through `20a6179986`).
- Out of scope: push notifications, iOS, git/PR workflow buttons, durable event replay (R2), mobile shell polish (R3).

## R2 — opencode mobile app: parity and resume hardening

- Status: in progress
- Tier: 2
- Effort: XL
- Depends on: R1
- Files: `packages/mobile/`, `packages/app/src/`, `packages/app/vendor/` (vendored `@opencode-ai/client` upgrade), `packages/client/`; replay widening slice shipped in `packages/schema/`, `packages/core/`, `packages/protocol/`, `packages/server/`, `packages/opencode/`, `packages/sdk/js/`, `packages/sdk/openapi.json`
- Goal: feature parity for daily phone use and true resume.
- Scope:
  - Durable per-session replay catch-up via `GET /api/session/:id/history` and `GET /api/session/:id/event?after=`. Finding 2026-10-09: the phone runs protocol v1 and the replay endpoints only carry `session.next.*` events from V2-runtime sessions, so replay returns nothing for the phone's sessions today. Server replay widening shipped 2026-10-10: both endpoints now replay legacy v1 durable events; the rest of R2 (vendored client upgrade, cursor caching, settled state, feature gaps, composer, iOS) is not started.
  - Settled/idle state saved across app restarts; replay cursor cached per session.
  - Feature gaps: edit-and-resend, reasoning display option, subagent drill-down, skill-call display.
  - Mobile composer polish: attachments and file references.
  - iOS platform from the same Capacitor package.
- Out of scope: push notifications, git/PR workflow buttons.

## R3 — opencode mobile app: mobile shell polish

- Status: shipped 2026-10-10
- Tier: 2
- Effort: L
- Depends on: R1
- Files: `packages/app/src/components/`, `packages/app/src/pages/`, `packages/app/src/utils/`, `packages/mobile/` (`@capacitor/haptics`), `packages/app/e2e/`
- Goal: finish the native-feel shell after Wave A lands on the phone.
- Scope: **M6b Waves B and C** in `feature.md` — W5 mobile sheets, W6 touch targets and long-press, W7 gestures and haptics, W8 timeline performance (measure first; targeted fixes only).
- Out of scope: iOS, push notifications, true native rewrite.
- Shipped: squash commit `57ca9f6c8b`; CI run `38017451055` built the APK; phone check passed 2026-10-10. Delivered W5 bottom sheets for the model/agent pickers, W6 long-press session action sheet with full 3-dot parity plus tool-output copy and native tap sizes, W7 swipe-to-archive with haptics (`@capacitor/haptics`), and the W8 `adverse.spec.ts` stability fix (`test:stability` 44/44). The long-session benchmark cannot run on the 5.3 GB dev machine; `test:stability` is the timeline regression gate.

## R4 — opencode mobile app: daily-use features

- Status: planned
- Tier: 2
- Effort: XL
- Depends on: R3 (W5 sheets for settings and pickers, W6 long-press, W7 swipe actions)
- Files: `packages/app/src/components/`, `packages/app/src/pages/home/`, `packages/app/src/pages/`, `packages/app/src/context/`, `packages/app/src/i18n/`, `packages/mobile/`, `packages/app/e2e/`, `packages/server/src/` (scratch project, confirm at plan review)
- Goal: make the phone app a daily driver: mobile settings, a richer sessions list, one session action menu, project-less sessions, and visible sync feedback.
- Scope (item numbers from the 2026-10-09 review, recorded in `feature.md`):
  - Mobile settings destination: its own entry point (#1), mobile-first layout instead of squeezed desktop chrome (#2), settings search (#20).
  - Sessions list v2: taller rows with project, branch, relative last-accessed time, and status (#12); pin sessions to the top (#4); project search in the top section (#18); expanding search icon for sessions and projects (#19).
  - Settle = archive shortcut (#5), auto-settle/archive on commit (#14).
  - Context info tap and Session/Changes context redesign (#15 residual, #23). Item #8 (one session action menu shared by the header and long-press) shipped in R3.
  - New session/project: prompt for a known project (#9), "No Project" scratch project (#13), friendlier directory navigator (#10).
  - Sync and feedback: moved to R5 (#6, #17).
  - Composer: Enter inserts a newline instead of sending (#22).
  - Model favorites (#3).
  - Native design pass: buttons, icons, navigation, and animation (#21).
- Out of scope: iOS, push notifications, durable replay (R2), true native rewrite.

## R5 — opencode mobile app: sync hardening (background, reconnect, feedback)

- Status: shipped 2026-10-09
- Tier: 2
- Effort: L
- Depends on: R1
- Files: `packages/app/src/utils/stream-watchdog.ts` (new), `packages/app/src/utils/app-lifecycle.ts` (new), `packages/app/src/context/server-sdk.tsx`, `packages/app/src/context/server-sync.tsx`, `packages/app/src/context/server-session.ts`, `packages/app/src/components/prompt-input/`, `packages/app/src/components/prompt-input-v2.tsx`, `packages/app/src/components/dialog-delete-session.tsx`, `packages/app/src/pages/home/`, `packages/app/src/pages/session/session-archive.ts`, `packages/app/src/components/mobile-session-header.tsx`, `packages/session-ui/src/v2/components/prompt-input/`, `packages/app/e2e/`
- Goal: after background, disconnect, or slow network, the phone shows current data, recovers a dead stream, closes message gaps with no visible hole, and shows pending feedback with no duplicate actions.
- Scope: stream watchdog and foreground restart (Capacitor lifecycle plus web visibility); single-flight resync of active sessions, home index, bootstrap, and active directories; open-session catch-up with gap closing bounded at 10 pages; pending and disabled states for new-session send, follow-up guard, archive, and delete.
- Out of scope: durable event replay and persisted cursor (R2), push notifications, iOS, desktop-only chrome changes.
- Shipped: commit `6834f18eef`, CI run `37977618749` built the APK; phone check passed 2026-10-09. Home-list archive coalesces duplicate taps even though the row button is hidden; the visible header archive path shows pending feedback.

## R6 — Global default model setting (Settings → Models)

- Status: shipped 2026-10-10
- Tier: 2
- Effort: S
- Depends on: R1
- Files: `packages/app/src/components/dialog-select-model.tsx`, `packages/app/src/components/settings-v2/models.tsx`, `packages/app/src/components/settings-v2/default-model.tsx` (new), `packages/app/src/components/settings-v2/default-model-behavior.ts` (new), `packages/app/src/hooks/provider-catalog.ts`, `packages/app/src/context/server-sync.tsx`, `packages/app/src/i18n/`, `packages/app/e2e/utils/mock-server.ts`, `packages/app/e2e/regression/settings-default-model.spec.ts` (new)
- Goal: one Settings → Models row that sets the server's global default model (`config.model`) so new sessions use it when no model was chosen. Existing sessions keep their model.
- Out of scope: clearing the default, protocol v2 write support, mobile settings redesign (R4), model favorites (R4 #3), legacy settings UI.
- Shipped: commit `0180671d8e`, CI run `38027644591` built the APK; phone check passed 2026-10-10. Includes the first-slash fix for legacy model IDs, an inline picker in the Models tab, and `refreshDirectories()` after a config write so new sessions see the default immediately.

## Implementation order

1. R4: mobile daily-use features.
2. R2: parity and resume hardening (client follow-ups).
