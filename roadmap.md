# Roadmap

Permanent items for this personal fork. IDs never change. Never renumber or delete an ID.

Status values: `planned`, `in progress`, `shipped YYYY-MM-DD (PR #N)`, `scrapped (reason)`.

Tiers: 1 = small fix, 2 = feature, 3 = strategic work that is not planned until pulled.

## R1 — opencode mobile app: Android shell foundation

- Status: in progress
- Tier: 2
- Effort: L
- Depends on: none
- Files: `packages/mobile/` (new), `packages/app/src/entry.tsx`, `packages/app/src/utils/` (new helpers), `packages/app/src/context/server-sdk.tsx`, `packages/app/src/pages/`, `packages/app/src/components/`, `packages/server/src/cors.ts`, `packages/opencode/test/server/`, `.github/workflows/personal-build.yml` (android job)
- Goal: an installable Android app that connects to a self-hosted opencode server over LAN `http` (enter IP, optional password), resumes reliably after sleep and network loss, and shows session status at a glance.
- Scope:
  - Capacitor Android shell that bundles the `packages/app` build.
  - First-run connect screen: server URL + optional username/password, with clear error states.
  - Reconnect supervisor: jittered exponential backoff, wake on `online` and on foreground, reconnect resync.
  - CORS allowance for the WebView app origin.
  - Mobile layout pass: safe areas, Android back button, sessions/status access, connection indicator.
- Out of scope: push notifications, iOS, git/PR workflow buttons, durable event replay (R2).

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

## Implementation order

1. R1 (active).
2. R2 after R1 ships.
