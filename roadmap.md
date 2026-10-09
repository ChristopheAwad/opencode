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

- Status: planned
- Tier: 2
- Effort: XL
- Depends on: R1
- Files: `packages/mobile/`, `packages/app/src/`, `packages/app/vendor/` (vendored `@opencode-ai/client` upgrade), `packages/client/`
- Goal: feature parity for daily phone use and true resume.
- Scope:
  - Durable per-session replay catch-up via `GET /api/session/:id/history` and `GET /api/session/:id/event?after=` (requires updating the vendored client; the pinned `1.17.13` tarball has no history/events endpoints).
  - Settled/idle state saved across app restarts; replay cursor cached per session.
  - Feature gaps: edit-and-resend, reasoning display option, subagent drill-down, skill-call display.
  - Mobile composer polish: attachments and file references.
  - iOS platform from the same Capacitor package.
- Out of scope: push notifications, git/PR workflow buttons.

## R3 — opencode mobile app: mobile shell polish

- Status: planned
- Tier: 2
- Effort: L
- Depends on: R1
- Files: `packages/app/src/components/`, `packages/app/src/pages/`, `packages/app/src/utils/`, `packages/mobile/` (`@capacitor/haptics`), `packages/app/e2e/`
- Goal: finish the native-feel shell after Wave A lands on the phone.
- Scope: **M6b Waves B and C** in `feature.md` — W5 mobile sheets, W6 touch targets and long-press, W7 gestures and haptics, W8 timeline performance (measure first; targeted fixes only).
- Out of scope: iOS, push notifications, true native rewrite.

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
  - One session action menu shared by the header and long-press (#8, #11 residual); context info tap and Session/Changes context redesign (#15 residual, #23).
  - New session/project: prompt for a known project (#9), "No Project" scratch project (#13), friendlier directory navigator (#10).
  - Sync and feedback: focus/visibility resync (fixes the web tab-switch staleness too), pending/syncing feedback when an action is tapped on a slow network (#6, #17).
  - Composer: Enter inserts a newline instead of sending (#22).
  - Model favorites (#3).
  - Native design pass: buttons, icons, navigation, and animation (#21).
- Out of scope: iOS, push notifications, durable replay (R2), true native rewrite.

## Implementation order

1. R3 (next): M6b Waves B and C.
2. R4: mobile daily-use features.
3. R2: parity and resume hardening.
