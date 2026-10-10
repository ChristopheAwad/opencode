# R6 — Global default model setting (Settings → Models)

This file is the handoff for R6 and is overwritten from the approved plan. Read
it top to bottom before touching code.

## Status

- R6: SHIPPED 2026-10-10. Squash commit `0180671d8e`; CI run `38027644591`
  built the APK (both jobs green); phone check passed. `roadmap.md` holds the
  durable record; implementation order is now R4 → R2.
- R3 shipped 2026-10-10; R2 remains `in progress` (replay slice shipped, client
  work remains). R6 had no file overlap with the R2 follow-ups.
- Plan review gate PASSED (three reviewer rounds: 8 blockers fixed in round 2,
  3 blockers in round 3, final round approved with no findings). The reviewer
  session ran against `insecure-combined` with R3 uncommitted; R3 merged
  without touching any R6 target file except a 2-line `mock-server.ts` config
  addition, which is incorporated below.
- Diff review gate PASSED 2026-10-10 (fresh reviewer, no blockers; 3 nits
  fixed locally).
- Never stage `.husky/pre-push` (pre-existing local edit) or `screenshots/`.
- No server or protocol changes. App-only.
- Baseline recorded before code changes: see "Baseline" below.

## Results (2026-10-10, branch `default-model-setting`)

- Commits: `6a5d91348c` (docs plan), `7230aa8644` (first-slash parse + tests),
  `dfe8efa733` (save behavior + tests), `f3266c6e3c` (row, adapter, i18n),
  `4eff0ccdf9` (inline picker), `e86a655690` (e2e).
- Fork sync note: mid-work the user merged `upstream/dev` into
  `insecure-combined` (`a92e481d87`) and stashed the WIP. The branch was
  rebased onto the new tip with no conflicts; the merge touched none of the R6
  files. `bun install --ignore-scripts` re-run after the merge.
- `packages/app` `bun run test:unit`: 835 pass / 0 fail (baseline 827, +8 new).
- `packages/app` `bun run typecheck` and `bun run typecheck:e2e`: clean.
- Targeted e2e `regression/settings-default-model.spec.ts`: 8 pass / 0 fail.
- Full e2e: 203 pass / 6 fail. Pre-existing known failures: 2
  `tab-strip-mobile-scroll` specs. The other 4 (`mobile-session-menu` export,
  `review-terminal-stacked`, `session-request-docks`, `session-todo-dock-navigation`)
  all pass in isolation (19/19 re-run) — full-run flakes on this 5.3 GB
  machine, the same class as R5's documented intermittent flakes. No failures
  in the new spec.
- `test:stability`: 44/44 (matches the R3 shipped baseline).
- Deviations from the plan: inline picker instead of a nested dialog (see
  Design); mock `/config` returns the in-memory config so the directory refresh
  sees the write; `/pty/shells` added to `emptyList`; the desktop localStorage
  seed is separate from `seedMobileServer` (the native test keeps its server
  `list`); the race test closes settings with `dialog.press("Escape")` because
  focus returns to the body after the inline list collapses.

## Goal

On the phone and on every app client using the V2 settings dialog, the user can
set one global default model. The app writes the server's global config `model`
field (`"provider/model"`) through the existing `PATCH /global/config`. New
sessions with no chosen model resolve to it. Existing sessions keep their model
(the session model freezes on the first user message).

## User decisions

- Control lives in Settings → Models (not in the model picker).
- It applies only to new sessions; a saved per-workspace/draft/session model
  keeps priority (fallback semantics).
- No mobile bottom-nav settings entry; settings stays reachable through the
  command palette.
- Fallback semantics accepted.

## Verified existing behavior (file:line)

- Server global default: `config.model`; `Provider.defaultModel()` uses it first
  (`packages/opencode/src/provider/provider.ts:2030-2032`);
  `SessionPrompt.createUserMessage` uses `input.model ?? ag.model ??
  currentModel` (`packages/opencode/src/session/prompt.ts:646`); the session
  model freezes on first user message (`prompt.ts:672-689`).
- Write API: `PATCH /global/config`
  (`packages/opencode/src/server/routes/instance/httpapi/groups/global.ts:97-116`)
  -> `Config.updateGlobal` deep-merges the global config file, invalidates the
  cache, and disposes instances when changed (`config.ts:656-680`; handler
  `handlers/global.ts:77-82` emits `global.disposed`).
- App plumbing: `useServerSync().updateConfig({...})`
  (`packages/app/src/context/server-sync.tsx:713-724, 741`) already used for
  `shell` and `disabled_providers`; on success it refetches bootstrap
  (`713-723`); `global.disposed` also queues active directories (`599-613`).
  Global config read: `data.config` getter (`server-sync.tsx:239, 283-285`);
  pending getter `data.reload` (`287-289`).
- Client resolution (v1): `resolveDefaultModel(providers.defaultModel(),
  sync().data.config.model)`
  (`packages/app/src/pages/session/composer/prompt-model-selection.ts:24-28`;
  `packages/app/src/context/local.tsx:156-160`). On v1 the legacy `/provider`
  response has no `defaultModel` property, so `resolveDefaultModel` falls back
  to the legacy `config.model` string (`hooks/provider-catalog.ts:29-37`; tests
  `provider-catalog.test.ts:69-76`). Order: prompt model -> agent model ->
  configured default -> recent -> fallback (`prompt-model-selection.ts:39-45`;
  `local.tsx:184`).
- New sessions get fresh `uuid()` draftIDs
  (`packages/app/src/context/tabs.tsx:209-212`); the V2 composer model is
  `prompt.model` persisted per draftID (`context/prompt-state.ts:172-176`), so
  a manual pick does not carry across new drafts. `store.draft` in `local.tsx`
  holds the agent selection only; `input.agent()?.model` is the agent's
  server-configured model, not a user pick.
- Settings: `settings.open` always opens the V2 `DialogSettings`
  (`packages/app/src/components/settings-dialog.tsx:20-24`); Models tab is
  `SettingsModelsV2` (`components/settings-v2/models.tsx`); rows via
  `SettingsRowV2`/`SettingsListV2` (`settings-v2/parts/`). Mobile reaches
  settings via the command palette (`components/mobile-nav.tsx:32-38`).
  `useServerProtocol()` is a memo accessor
  (`context/server-sdk.tsx:494-497`).
- Bug found: `resolveDefaultModel` does `legacy.split("/")` and drops slashes
  inside model IDs (`hooks/provider-catalog.ts:35`), while the server parses on
  the first slash only (`provider.ts:2080-2086`).

## Design

1. `packages/app/src/hooks/provider-catalog.ts`: `resolveDefaultModel` splits
   the legacy string on the FIRST `/` only and returns undefined when the
   provider or model part is empty. The null-vs-undefined contract is
   unchanged: `null` means "current server has a default, ignore legacy";
   `undefined` means "legacy server, use `config.model`".
   `parseConfigModel(value)` is `resolveDefaultModel(undefined, value)`; no
   second parser.
2. `packages/app/src/components/dialog-select-model.tsx`: export the existing
   `ModelList` (add `export`). No other change. `ModelList` uses
   `props.model ?? useLocal().model` (`:54`), so passing a model prop never
   evaluates `useLocal()`. `DialogSelectModel` is untouched.
3. New `packages/app/src/components/settings-v2/default-model-behavior.ts`:
   pure `saveDefaultModel({ protocol, key, previous, set, update, refresh,
   onError })`:
   - return early (no request, no refresh) when `protocol !== "v1"` or
     `key === previous`;
   - `set(key)` (optimistic), then `await update({ model: key })`, then
     `refresh()`;
   - on throw: `set(previous)` and `onError(error)`.
4. New `packages/app/src/components/settings-v2/default-model.tsx`:
   - `createDefaultModelSelection()`: a `ModelSelection` adapter built from
     `useModels()`, `useServerSync()`, `useServerProtocol()`, `useLanguage()`:
     `ready: models.ready`, `current` (via `models.find(parseConfigModel(...))`,
     all models, ignores visibility), `recent: () => []`, `list: models.list`,
     `cycle: () => {}`, `set` (calls `saveDefaultModel`), `visible`,
     `setVisibility`, and `variant` stubs (all empty).
   - `SettingsDefaultModelV2`: `SettingsRowV2` title
     `settings.models.defaultModel.title`, description
     `settings.models.defaultModel.description`, control `ButtonV2` with
     `data-action="settings-default-model"` and `aria-expanded`. Label order:
     `command.model.choose` until `models.ready()`; then
     `selection.current()?.name`; else the raw `config.model` string when
     non-empty; else `command.model.choose`. Disabled while
     `serverSync().data.reload === "pending"`. The button toggles an inline
     `ModelList` panel (`data-component="settings-default-model-list"`) below
     the row; selecting a model saves and collapses the panel.
   - Deviation from the reviewed plan: the picker is inline, not a nested
     `Dialog`. A nested V1 `Dialog` inside the V2 settings dialog makes the
     settings dialog dismiss on pointerdown (the V1 `Dialog` does not register
     a nested Kobalte dismissable layer), which closed the whole settings
     dialog on every selection. The inline panel keeps the interaction inside
     one dialog and is also phone-friendly. `ModelList` is still the shared
     component (exported from `dialog-select-model.tsx`).
5. `packages/app/src/components/settings-v2/models.tsx`: render
   `<SettingsDefaultModelV2 />` above the search/list (outside
   `useFilteredList`, so search never hides it), gated on
   `useServerProtocol() === "v1"`.
6. `packages/app/src/context/server-sync.tsx`: add `refreshDirectories()` to
   the returned object: push every active child directory to the refresh queue
   (`for (const directory of Object.keys(children.children)) if
   (children.active(directory)) queue.push(directory)`). `saveDefaultModel`
   calls it after the update resolves, when `queue.paused()` is false.
7. i18n: add two keys to `en.ts` and all 61 non-English locales:
   - `settings.models.defaultModel.title` = "Default model"
   - `settings.models.defaultModel.description` = "Model used for new sessions."
   Terminology anchors per locale: that locale's `settings.models.title`
   (model term), `common.default` (default term), session strings
   (`command.session.new`, home session strings). Keep established borrowings
   (do not invent a translation where the locale keeps "Model"). No plurals,
   so CLDR plural categories do not apply. Cross-check major locales against
   the corpora listed in `packages/app/AGENTS.md` (Microsoft, Apple, Mozilla
   firefox-l10n/Pontoon; RAE/Fundéu, FranceTerme, Duden, TDK, Kotus,
   Språkrådet, Rada Języka Polskiego, and the other language authorities).
   Record uncertain or region-specific terms in "Translation notes" below for
   native review. The parity test
   (`packages/app/src/i18n/parity.test.ts:99-120`) must stay green.
8. Out of scope: clearing the default (server `Config.updateGlobal` deep-merges
   and JSON drops `undefined`, so deleting a key needs a server change; no
   clear affordance), `small_model`, agent model overrides, model favorites
   (R4 #3), mobile settings redesign (R4), legacy settings UI, protocol v2
   write support, bottom-nav settings entry.

## Baseline

Record before code changes:

- `packages/app` `bun run test:unit`: 827 pass / 0 fail (recorded 2026-10-10,
  before R6 code).
- `packages/app` `bun run typecheck` and `bun run typecheck:e2e`: clean.
- `test:stability`: 44/44 (R3 shipped state).
- Full e2e: recorded in "Results" after the run; compare against the R3/R5
  known pre-existing failures (2 `tab-strip-mobile-scroll` specs, and the R3
  `adverse.spec.ts` fix makes stability 44/44).

## Tests first

Unit (`packages/app/src`, bun test, no wall-clock waits):

- `hooks/provider-catalog.test.ts`: add slashed model ID
  `openrouter/meta-llama/llama-3-70b` -> `{providerID: "openrouter", modelID:
  "meta-llama/llama-3-70b"}`; `"provider/"`, `"/model"`, `""` -> undefined;
  existing null/undefined cases unchanged.
- `components/settings-v2/default-model-behavior.test.ts`:
  - success: `set(key)` called, one `update({ model: key })`, `refresh` called
    once;
  - failure: `set(key)` then `set(previous)`, `onError` called, no `refresh`;
  - skip: `key === previous` -> no update, no refresh, no set;
  - protocol guard: `protocol: "v2"` -> no update, no refresh, no set;
  - previous undefined rollback on failure.

E2E (`packages/app/e2e`, waits registered before the triggering action, no
`waitForTimeout`):

- Extend `utils/mock-server.ts`: `/global/config` handled method-aware (GET
  returns the in-memory config, PATCH records `onConfigUpdate`, merges the body
  into memory, returns it). R3 already added `config?: Record<string, unknown>`
  to `MockServerConfig`; keep it. `/config` (the per-instance config) returns
  the same in-memory config so the directory-config refresh sees the write.
  `/pty/shells` joins `emptyList` (the General settings tab crashes on `{}`).
- New `regression/settings-default-model.spec.ts`:
  a. v1 empty config: open settings (`Control+,`), Models tab, row title and
     description visible, button "Choose model"; open the inline list; pick
     "Server A Model"; assert PATCH body `{ model: "server-a/server-a" }`; row
     shows the model name after the bootstrap refetch; list collapses.
  b. v1 initial `{ model: "server-a/server-a" }`: row shows the model name on
     open; pick another model; second PATCH with the new value.
  c. slashed model ID in the mock provider list and in the initial config: row
     resolves to the display name (validates the first-slash parse end to end).
  d. failure: PATCH-only `page.route` override returns 500, GET falls back
     (`route.fallback()`); assert the "Request failed" toast and the rolled-back
     row label.
  e. v2 (`protocol: "v2"`): row not rendered.
  f. mobile native shell: `mockOpenCodeServer` with `protocol: "v1"` +
     `installNativeShell` + `seedMobileServer`; reach settings via the MobileNav
     search/command palette; pick a model; PATCH fires. The desktop localStorage
     seed must not overwrite `seedMobileServer`'s server `list` (the mock helper
     seeds only for desktop tests).
  g. race: after changing the default, immediately start a new session and
     assert the composer model control shows the new default name (proves the
     directory-config refresh; the provider fallback is a different model).

## Commands (from package dirs)

- `packages/app`: `bun run typecheck`, `bun run typecheck:e2e`,
  `bun run test:unit`, `bun run test:e2e -- regression/settings-default-model.spec.ts`,
  full `bun run test:e2e`, `bun run test:stability`.
- i18n parity runs inside `test:unit`.

## Implementation order

1. Tests first (unit + e2e above).
2. `provider-catalog.ts` first-slash fix.
3. `server-sync.tsx` `refreshDirectories()`.
4. `default-model-behavior.ts` + `default-model.tsx` + export `ModelList`.
5. `settings-v2/models.tsx` row.
6. i18n keys in en + 61 locales.
7. Full verification, diff review gate, then user approval to merge and push.

## Risks and mitigations

- Global config update disposes server instances -> brief reconnect on the
  phone; the app already resyncs on `global.disposed`. Existing sessions are
  unaffected (model frozen).
- `config.model` affects the server globally (TUI/desktop/headless). Intended.
- Directory-config staleness after the write: `refreshDirectories()` after the
  mutation settles, plus e2e case (g).
- Model IDs with slashes: fixed by the first-slash parse; covered by unit and
  e2e cases.
- Protocol v2: row hidden; save helper guards `protocol !== "v1"`.
- Settings dialog on the phone is still desktop chrome (R4 will redesign it).
  Accepted; R4 can swap the picker to the R3 `MobileSheet`.
- i18n: 2 keys x 61 locales; parity test enforces key presence; translation
  notes below.

## Translation notes

- Locales that keep an established borrowing for "model" follow their existing
  `settings.models.title` value (for example id/ms keep "Model", ja/ko/zh keep
  the CJK term).
- Uncertain or region-specific values for native review: `dv` (Dhivehi
  inflection of "new session"), `dz` (Dzongkha compound for "used for new
  sessions"), `fo` (Faroese "fyrimynd" vs "model"), `km` (Khmer "សម័យ" for
  session), `si` (Sinhala "ආකෘතිය" for model), `am` (Amharic "ክፍለ ጊዜ" for
  session). All other locales reuse the exact terminology of their existing
  settings/session strings.

## Plan review log (2026-10-09/10)

- Round 1: 8 blockers (wrong pending path; underspecified `ModelList` refactor;
  e2e mock reverting the optimistic row; directory-scope staleness and draft
  carryover; i18n fragment copy; no unset/invalid spec; missing branch/base and
  roadmap transition; render-only v1 guard). All fixed.
- Round 2: 3 blockers (DialogSelectModel `useLocal` crash outside a directory;
  mobile e2e protocol contradiction; `onSuccess` queue paused timing). All
  fixed: dedicated dialog on the exported `ModelList`; `mockOpenCodeServer`
  v1 + `installNativeShell`; `refreshDirectories()` called after settle.
- Round 3: approved, no blockers and no nits.

## Diff review log (2026-10-10)

- Round 1 (fresh reviewer, `git diff insecure-combined...HEAD`): no blockers.
  3 nits fixed locally without a rerun: German `de.ts` relative pronoun
  (`das` not `der`); `aria-controls="settings-default-model-list"` added to the
  toggle; locale-count wording corrected to 61 non-English locales. Parity
  test, typecheck, and the targeted e2e spec re-run green after the fixes.
