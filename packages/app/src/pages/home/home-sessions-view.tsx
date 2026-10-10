import type { Session } from "@opencode-ai/sdk/v2/client"
import { type Accessor, createEffect, createMemo, createSignal, For, onCleanup, onMount, Show, Suspense } from "solid-js"
import { Spinner } from "@opencode-ai/ui/spinner"
import { ScrollView } from "@opencode-ai/ui/scroll-view"
import { ButtonV2 } from "@opencode-ai/ui/v2/button-v2"
import { Icon as IconV2 } from "@opencode-ai/ui/v2/icon"
import { IconButtonV2 } from "@opencode-ai/ui/v2/icon-button-v2"
import { TooltipV2 } from "@opencode-ai/ui/v2/tooltip-v2"
import { useLanguage } from "@/context/language"
import { ServerConnection } from "@/context/server"
import { SessionTabAvatarView } from "@/pages/layout/session-tab-avatar"
import { subscribeLongPress } from "@/utils/long-press"
import { hapticImpact } from "@/utils/native-haptics"
import { isNativeShell } from "@/utils/native-platform"
import { sessionTitle } from "@/utils/session-title"
import { createSwipeGesture } from "@/utils/swipe-action"
import { shouldOpenSessionInBackground } from "../home-session-open"
import {
  HomeSessionStatusController,
  homeSessionSearchKey,
  type HomeSessionGroup,
  type HomeSessionRecord,
  type OpenSessionOptions,
} from "./home-sessions-controller"

const SHOW_HOME_SESSION_ARCHIVE = false
const HOME_SECTION_LABEL = "text-v2-text-text-muted [font-weight:440]"
const HOME_SESSION_SEARCH_RESULTS_ID = "home-session-search-results"

// Middle-click or Cmd+click on macOS (Ctrl+click elsewhere) opens a session
// tab in the background without navigating, matching browser conventions.
function isBackgroundOpen(event: MouseEvent) {
  return shouldOpenSessionInBackground({
    button: event.button,
    mac: typeof navigator === "object" && /(Mac|iPod|iPhone|iPad)/.test(navigator.platform),
    meta: event.metaKey,
    ctrl: event.ctrlKey,
    shift: event.shiftKey,
    alt: event.altKey,
  })
}

function useSessionRowLongPress(props: {
  record: HomeSessionRecord
  onOpenSessionMenu: (record: HomeSessionRecord) => void
}) {
  const native = isNativeShell()
  let element: HTMLButtonElement | undefined
  let suppressClick = false

  onMount(() => {
    if (!native || !element) return
    onCleanup(
      subscribeLongPress(element, () => {
        suppressClick = true
        props.onOpenSessionMenu(props.record)
      }),
    )
  })

  return {
    ref: (target: HTMLButtonElement) => {
      element = target
    },
    clearClick: () => {
      suppressClick = false
    },
    takeClick: () => {
      if (!suppressClick) return false
      suppressClick = false
      return true
    },
  }
}

function useSessionRowGestures(props: {
  record: HomeSessionRecord
  onOpenSessionMenu: (record: HomeSessionRecord) => void
  onArchiveSession: (session: Session) => Promise<void>
  onReveal: (key: string, reset: () => void) => void
  onCloseReveal: (key: string) => void
}) {
  const native = isNativeShell()
  const [offset, setOffset] = createSignal(0)
  let element: HTMLButtonElement | undefined
  let suppressClick = false
  let moved = false
  let start: { x: number; y: number } | undefined
  let swipe: ReturnType<typeof createSwipeGesture> | undefined
  const resetReveal = () => {
    props.onCloseReveal(props.record.session.id)
    swipe?.reset()
    setOffset(0)
  }

  onMount(() => {
    if (!native || !element) return
    onCleanup(
      subscribeLongPress(element, () => {
        swipe?.onPointerCancel()
        setOffset(0)
        props.onCloseReveal(props.record.session.id)
        suppressClick = true
        props.onOpenSessionMenu(props.record)
      }),
    )
  })

  const armSwipe = () => {
    if (!native || !element) return
    swipe = createSwipeGesture({
      width: element.getBoundingClientRect().width,
      direction: document.documentElement.dir === "rtl" ? -1 : 1,
    })
  }

  const onPointerDown = (event: PointerEvent) => {
    suppressClick = false
    moved = false
    start = { x: event.clientX, y: event.clientY }
    if (!native) return
    try {
      ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
    } catch {
      // Synthetic events may not support pointer capture.
    }
    armSwipe()
    swipe?.onPointerDown(event.clientX, event.clientY)
  }
  const onPointerMove = (event: PointerEvent) => {
    if (!swipe) return
    if (start && Math.hypot(event.clientX - start.x, event.clientY - start.y) > 10) moved = true
    swipe.onPointerMove(event.clientX, event.clientY)
    const next = swipe.offset()
    setOffset(next)
  }
  const onPointerUp = (event: PointerEvent) => {
    if (!swipe) return
    if (event.currentTarget instanceof HTMLElement && event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    const result = swipe.onPointerUp()
    setOffset(swipe.offset())
    if (result === "reveal") {
      props.onReveal(props.record.session.id, resetReveal)
      return
    }
    if (result !== "commit") return
    if (native) hapticImpact("medium")
    void props.onArchiveSession(props.record.session).finally(resetReveal)
  }
  const onPointerCancel = (event: PointerEvent) => {
    if (event.currentTarget instanceof HTMLElement && event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    swipe?.onPointerCancel()
    setOffset(0)
    props.onCloseReveal(props.record.session.id)
  }

  return {
    ref: (target: HTMLButtonElement) => {
      element = target
    },
    offset,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
    consumeClick: (event: MouseEvent) => {
      if (suppressClick) {
        suppressClick = false
        event.preventDefault()
        return true
      }
      if (moved) {
        moved = false
        event.preventDefault()
        return true
      }
      if (offset() === 0) return false
      swipe?.reset()
      setOffset(0)
      props.onCloseReveal(props.record.session.id)
      event.preventDefault()
      event.stopPropagation()
      return true
    },
  }
}

export type HomeSessionsViewProps = {
  language: ReturnType<typeof useLanguage>
  groups: Accessor<HomeSessionGroup[]>
  showProjectName: Accessor<boolean>
  server: Accessor<ServerConnection.Key>
  canCreateSession: Accessor<boolean>
  searchValue: Accessor<string>
  searchPlaceholder: Accessor<string>
  searchOpen: Accessor<boolean>
  searchLoading: Accessor<boolean>
  searchResults: Accessor<HomeSessionRecord[]>
  searchActive: Accessor<string>
  searchNoResultsLabel: Accessor<string>
  titleOpacity: (id: HomeSessionGroup["id"]) => number
  isOpenTab: (record: HomeSessionRecord) => boolean
  onCreateSession: () => void
  onOpenSession: (session: Session, options?: OpenSessionOptions) => void
  onOpenSessionMenu: (record: HomeSessionRecord) => void
  onArchiveSession: (session: Session) => Promise<void>
  archivePending: (sessionID: string) => boolean
  onSetHoverTarget: (element: HTMLElement) => void
  onSetThumbTrack: (element: HTMLDivElement) => void
  onSetContent: (element: HTMLDivElement) => void
  onSetHeader: (id: HomeSessionGroup["id"], element: HTMLDivElement) => void
  onWheel: (event: WheelEvent) => void
  onSetSearchRoot: (element: HTMLDivElement) => void
  onSetSearchInput: (element: HTMLInputElement) => void
  onSetSearchList: (element: HTMLDivElement) => void
  onSearchFocus: () => void
  onSearchInput: (value: string) => void
  onSearchClose: () => void
  onSearchMove: (delta: number) => void
  onSearchSelectActive: () => void
  onSearchHighlight: (record: HomeSessionRecord) => void
  onSearchSelect: (record: HomeSessionRecord, options?: OpenSessionOptions) => void
}

type HomeSessionRowProps = HomeSessionsViewProps & {
  record: HomeSessionRecord
  onReveal: (key: string, reset: () => void) => void
  onCloseReveal: (key: string) => void
}

export function HomeSessionsView(props: HomeSessionsViewProps) {
  const [revealed, setRevealed] = createSignal<{ key: string; reset: () => void } | null>(null)
  const closeRevealed = () => {
    const current = revealed()
    setRevealed(null)
    current?.reset()
  }
  const clearRevealed = (key: string) => {
    if (revealed()?.key === key) setRevealed(null)
  }
  createEffect(() => {
    const current = revealed()
    if (!current) return
    const handler = (event: PointerEvent) => {
      const target = event.target
      if (target instanceof Element && target.closest(`[data-reveal-key="${current.key}"]`)) return
      closeRevealed()
    }
    document.addEventListener("pointerdown", handler, true)
    onCleanup(() => document.removeEventListener("pointerdown", handler, true))
  })

  return (
    <section
      ref={props.onSetHoverTarget}
      class="min-h-0 min-w-0 flex-1 flex flex-col"
      aria-label={props.language.t("sidebar.project.recentSessions")}
    >
      <div class="sticky top-0 z-30 shrink-0 bg-v2-background-bg-base pb-3 pt-6 lg:pt-12" onWheel={props.onWheel}>
        <HomeSessionSearch {...props} />
        <Suspense>
          <Show when={props.groups().length > 0 && props.canCreateSession()}>
            <div class="pointer-events-none absolute right-0 top-[84px] z-20 flex lg:top-[108px]">
              <ButtonV2
                data-action="home-new-session"
                variant="ghost-muted"
                size="normal"
                icon="edit"
                class="pointer-events-auto h-7 px-2 [font-weight:530]"
                onClick={props.onCreateSession}
              >
                {props.language.t("command.session.new")}
              </ButtonV2>
            </div>
          </Show>
        </Suspense>
      </div>
      <div class="pointer-events-none sticky top-[84px] z-40 h-0 -mr-3 lg:top-[108px]">
        <div
          ref={props.onSetThumbTrack}
          data-component="home-session-scroll-track"
          class="relative ml-auto h-[calc(100cqh-84px)] w-3 lg:h-[calc(100cqh-108px)]"
        />
      </div>
      <div class="-mr-3 min-h-[calc(100cqh-72px)] lg:min-h-[calc(100cqh-96px)]">
        <Suspense
          fallback={
            <div class="pt-3">
              <HomeSessionSkeleton label={props.language.t("common.loading")} />
            </div>
          }
        >
          <Show
            when={props.groups().length > 0}
            fallback={
              <HomeSessionsEmpty
                onNewSession={props.canCreateSession() ? props.onCreateSession : undefined}
                language={props.language}
              />
            }
          >
            <div ref={props.onSetContent} class="flex flex-col pt-3 pr-3 pb-16">
              <For each={props.groups()}>
                {(group, index) => (
                  <>
                    <HomeSessionGroupHeader
                      title={group.title}
                      titleOpacity={props.titleOpacity(group.id)}
                      onSetRef={(element) => props.onSetHeader(group.id, element)}
                      elevated={index() === 0}
                    />
                    <div
                      class={`flex min-w-0 flex-col gap-px pt-4 ${index() === props.groups().length - 1 ? "" : "mb-6"}`}
                    >
                      <For each={group.sessions}>
                        {(record) => (
                          <HomeSessionRow
                            {...props}
                            record={record}
                            onReveal={(key, reset) => setRevealed({ key, reset })}
                            onCloseReveal={clearRevealed}
                          />
                        )}
                      </For>
                    </div>
                  </>
                )}
              </For>
            </div>
          </Show>
        </Suspense>
      </div>
    </section>
  )
}

function HomeSessionLeadingController(props: {
  server: HomeSessionsViewProps["server"]
  isOpenTab: HomeSessionsViewProps["isOpenTab"]
  record: HomeSessionRecord
  revealProjectOnHover: boolean
}) {
  return (
    <HomeSessionStatusController
      server={props.server}
      record={props.record}
      isOpenTab={props.isOpenTab}
      render={(state) => (
        <HomeSessionLeading
          record={props.record}
          revealProjectOnHover={props.revealProjectOnHover}
          open={state.open()}
          unread={state.unread()}
          loading={state.loading()}
        />
      )}
    />
  )
}

function HomeSessionLeading(props: {
  record: HomeSessionRecord
  revealProjectOnHover: boolean
  open: boolean
  unread: boolean
  loading: boolean
}) {
  return (
    <div class="relative shrink-0">
      <Show when={props.open}>
        <span
          aria-hidden="true"
          class={`
            pointer-events-none absolute top-1/2 h-3 w-0.5 -translate-y-1/2
            rounded-[2px] bg-v2-background-bg-layer-04
          `}
          style={{ right: "calc(100% + 4px)" }}
        />
      </Show>
      <SessionTabAvatarView
        project={props.record.project}
        directory={props.record.session.directory}
        revealProjectOnHover={props.revealProjectOnHover}
        unread={props.unread}
        loading={props.loading}
      />
    </div>
  )
}

function HomeSessionSearch(props: HomeSessionsViewProps) {
  return (
    <div class="w-full">
      <div ref={props.onSetSearchRoot} data-component="home-session-search" class="relative z-30 w-full">
        <Show when={props.searchOpen()}>
          <div
            data-component="home-session-search-panel"
            class={`
              absolute flex flex-col overflow-hidden rounded-[12px]
              bg-v2-background-bg-base shadow-[var(--v2-elevation-floating)]
            `}
            style={{ top: "-6px", left: "-6px", width: "calc(100% + 12px)" }}
          >
            <div class="flex flex-col pt-9">
              <div id={HOME_SESSION_SEARCH_RESULTS_ID} role="listbox" class="flex flex-col gap-4 pt-4">
                <Show
                  when={!props.searchLoading()}
                  fallback={
                    <div class="flex items-center justify-center px-4 py-3 text-v2-text-text-muted [font-weight:440]">
                      <Spinner class="size-4" />
                    </div>
                  }
                >
                  <Show
                    when={props.searchResults().length > 0}
                    fallback={
                      <p
                        class={`
                          my-1.5 px-4 pb-2 text-[13px] leading-4 tracking-[-0.04px]
                          text-v2-text-text-muted [font-weight:440]
                        `}
                      >
                        {props.searchNoResultsLabel()}
                      </p>
                    }
                  >
                    <div class="flex flex-col">
                      <p
                        class={`
                          my-1.5 pl-[18px] pr-6 text-[13px] leading-4 tracking-[-0.04px]
                          text-v2-text-text-muted [font-weight:440]
                        `}
                      >
                        {props.language.t("home.sessions.search.sessions")}
                      </p>
                      <ScrollView class="max-h-80" viewportRef={props.onSetSearchList}>
                        <div class="flex flex-col gap-px pb-2">
                          <For each={props.searchResults()}>
                            {(record) => (
                              <HomeSessionSearchResultRow
                                {...props}
                                record={record}
                                selected={props.searchActive() === homeSessionSearchKey(record)}
                              />
                            )}
                          </For>
                        </div>
                      </ScrollView>
                    </div>
                  </Show>
                </Show>
              </div>
            </div>
          </div>
        </Show>
        <label
          class={`
            relative z-20 flex h-9 w-full items-center gap-2 rounded-[6px] py-1 pl-3 pr-2
            bg-v2-background-bg-layer-02/60 text-v2-icon-icon-muted transition-[background-color,box-shadow]
            duration-[120ms] ease-in-out hover:bg-v2-background-bg-layer-02 focus-within:bg-v2-background-bg-layer-02
          `}
        >
          <IconV2 name="magnifying-glass" />
          <input
            ref={props.onSetSearchInput}
            class={`
              relative z-20 min-w-0 flex-1 border-0 bg-transparent outline-0
              text-v2-text-text-base [font-weight:440] placeholder:text-v2-text-text-faint
            `}
            value={props.searchValue()}
            placeholder={props.searchPlaceholder()}
            aria-label={props.searchPlaceholder()}
            aria-expanded={props.searchOpen()}
            aria-controls={HOME_SESSION_SEARCH_RESULTS_ID}
            aria-autocomplete="list"
            aria-activedescendant={
              props.searchActive() && props.searchOpen()
                ? `home-session-search-option-${props.searchActive()}`
                : undefined
            }
            onFocus={props.onSearchFocus}
            onInput={(event) => props.onSearchInput(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault()
                props.onSearchClose()
                event.currentTarget.blur()
                return
              }
              if (!props.searchOpen() || props.searchResults().length === 0) return
              if (event.altKey || event.metaKey) return
              if (event.key === "ArrowDown") {
                event.preventDefault()
                props.onSearchMove(1)
                return
              }
              if (event.key === "ArrowUp") {
                event.preventDefault()
                props.onSearchMove(-1)
                return
              }
              if (event.key === "Enter" && !event.isComposing) {
                event.preventDefault()
                props.onSearchSelectActive()
              }
            }}
          />
          <Show when={props.searchValue()}>
            <IconButtonV2
              type="button"
              variant="ghost-muted"
              size="small"
              class="relative z-20 shrink-0"
              icon={<IconV2 name="close" size="large" class="text-v2-icon-icon-muted" />}
              aria-label={props.searchPlaceholder()}
              onClick={() => {
                props.onSearchClose()
                props.onSearchFocus()
              }}
            />
          </Show>
        </label>
      </div>
    </div>
  )
}

function HomeSessionSearchResultRow(
  props: HomeSessionsViewProps & {
    record: HomeSessionRecord
    selected: boolean
  },
) {
  const title = createMemo(() => sessionTitle(props.record.session.title) || props.record.session.id)
  const showProjectName = () => props.showProjectName() && props.record.projectName
  const key = () => homeSessionSearchKey(props.record)
  const longPress = useSessionRowLongPress(props)
  const native = isNativeShell()

  return (
    <button
      type="button"
      id={`home-session-search-option-${key()}`}
      data-key={key()}
      data-component="home-session-search-row"
      role="option"
      aria-selected={props.selected}
      ref={longPress.ref}
      class={`
        flex h-10 w-full shrink-0 cursor-default items-center gap-2 border-0 py-3 pl-[18px] pr-6 text-left
        transition-[background-color] duration-[120ms] ease-in-out
        hover:bg-v2-overlay-simple-overlay-hover focus-visible:bg-v2-overlay-simple-overlay-hover focus-visible:outline-none
      `}
      classList={{
        "bg-v2-overlay-simple-overlay-hover": props.selected,
        group: !!showProjectName(),
        "h-12": native,
      }}
      onMouseEnter={() => props.onSearchHighlight(props.record)}
      onPointerDown={() => longPress.clearClick()}
      onMouseDown={(event) => {
        if (event.button === 1) event.preventDefault()
      }}
      onClick={(event) => {
        if (longPress.takeClick()) {
          event.preventDefault()
          return
        }
        props.onSearchSelect(props.record, { background: isBackgroundOpen(event) })
      }}
      onAuxClick={(event) => {
        if (!isBackgroundOpen(event)) return
        event.preventDefault()
        props.onSearchSelect(props.record, { background: true })
      }}
    >
      <HomeSessionLeadingController
        server={props.server}
        isOpenTab={props.isOpenTab}
        record={props.record}
        revealProjectOnHover={!!showProjectName()}
      />
      <div class="flex min-w-0 flex-1 items-center gap-1.5">
        <HomeSessionTitle title={title()} showProjectName={!!showProjectName()} search />
        <Show when={showProjectName()}>
          <HomeSessionProjectName name={props.record.projectName} search />
        </Show>
      </div>
    </button>
  )
}

function HomeSessionGroupHeader(props: {
  title: string
  titleOpacity: number
  onSetRef: (element: HTMLDivElement) => void
  elevated?: boolean
}) {
  return (
    <div
      ref={props.onSetRef}
      class={`
        pointer-events-none sticky top-[84px] flex h-7 min-w-0 items-center justify-between
        bg-v2-background-bg-base pl-3 lg:top-[108px]
      `}
      classList={{ "home-session-group-header z-[5]": !!props.elevated, "z-10": !props.elevated }}
    >
      <div class={HOME_SECTION_LABEL} style={{ opacity: props.titleOpacity }}>
        {props.title}
      </div>
    </div>
  )
}

function HomeSessionRow(props: HomeSessionRowProps) {
  const title = createMemo(() => sessionTitle(props.record.session.title) || props.record.session.id)
  const showProjectName = () => props.showProjectName() && props.record.projectName
  const native = isNativeShell()
  const gestures = useSessionRowGestures({
    record: props.record,
    onOpenSessionMenu: props.onOpenSessionMenu,
    onArchiveSession: props.onArchiveSession,
    onReveal: props.onReveal,
    onCloseReveal: props.onCloseReveal,
  })

  return (
    <div
      data-reveal-key={native ? props.record.session.id : undefined}
      class="group/session relative flex h-10 min-w-0 items-center rounded-[6px]"
      classList={{ group: !!showProjectName(), "h-12 overflow-hidden": native }}
    >
      <Show when={native || SHOW_HOME_SESSION_ARCHIVE}>
        <div
          data-component="home-session-archive-affordance"
          class="absolute inset-y-0 end-1.5 flex items-center gap-1"
          aria-hidden={gestures.offset() === 0 ? "true" : "false"}
        >
          <TooltipV2 class="flex shrink-0 items-center" placement="bottom" value={props.language.t("common.archive")}>
            <IconButtonV2
              data-action="home-session-archive"
              variant="ghost-muted"
              size="large"
              icon={
                props.archivePending(props.record.session.id) ? <Spinner class="size-4" /> : <IconV2 name="archive" />
              }
              aria-busy={props.archivePending(props.record.session.id) ? "true" : undefined}
              aria-label={props.language.t("common.archive")}
              disabled={props.archivePending(props.record.session.id)}
              onClick={(event) => {
                event.preventDefault()
                event.stopPropagation()
                void props.onArchiveSession(props.record.session)
              }}
            />
          </TooltipV2>
        </div>
      </Show>
      <button
        type="button"
        data-component="home-session-row"
        ref={gestures.ref}
        style={native ? { transform: `translateX(${gestures.offset()}px)`, "touch-action": "pan-y" } : undefined}
        class={`
          flex h-10 min-w-0 w-full flex-1 shrink-0 cursor-default items-center gap-2 rounded-[6px] border-0
          bg-transparent py-3 pl-3 pr-10 text-left text-v2-text-text-muted [font-weight:530]
          transition-[background-color,color,box-shadow] duration-[120ms] ease-in-out
          hover:bg-v2-overlay-simple-overlay-hover focus-visible:bg-v2-overlay-simple-overlay-hover focus-visible:outline-none
        `}
        classList={{ "h-12 bg-v2-background-bg-base relative": native }}
        onPointerDown={gestures.onPointerDown}
        onPointerMove={gestures.onPointerMove}
        onPointerUp={gestures.onPointerUp}
        onPointerCancel={gestures.onPointerCancel}
        onMouseDown={(event) => {
          if (event.button === 1) event.preventDefault()
        }}
        onClick={(event) => {
          if (gestures.consumeClick(event)) return
          props.onOpenSession(props.record.session, { background: isBackgroundOpen(event) })
        }}
        onAuxClick={(event) => {
          if (!isBackgroundOpen(event)) return
          event.preventDefault()
          props.onOpenSession(props.record.session, { background: true })
        }}
      >
        <HomeSessionLeadingController
          server={props.server}
          isOpenTab={props.isOpenTab}
          record={props.record}
          revealProjectOnHover={!!showProjectName()}
        />
        <HomeSessionTitle title={title()} showProjectName={!!showProjectName()} />
        <Show when={showProjectName()}>
          <HomeSessionProjectName name={props.record.projectName} />
        </Show>
      </button>
    </div>
  )
}

function HomeSessionTitle(props: { title: string; showProjectName: boolean; search?: boolean }) {
  return (
    <span
      class="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-v2-text-text-base [font-weight:530]"
      classList={{
        "text-[13px] leading-4 tracking-[-0.04px]": !!props.search,
        "max-w-[min(70%,480px)] flex-[0_1_auto]": props.showProjectName,
        "flex-[1_1_auto]": !props.showProjectName,
      }}
    >
      {props.title}
    </span>
  )
}

function HomeSessionProjectName(props: { name: string; search?: boolean }) {
  return (
    <span
      class="min-w-0 flex-[1_1_auto] overflow-hidden text-ellipsis whitespace-nowrap text-v2-text-text-muted [font-weight:440]"
      classList={{ "text-[13px] leading-4 tracking-[-0.04px]": !!props.search }}
    >
      {props.name}
    </span>
  )
}

function HomeSessionsEmpty(props: { onNewSession?: () => void; language: ReturnType<typeof useLanguage> }) {
  return (
    <div class="flex min-h-full flex-col items-center gap-4 px-6 pt-[52px] text-center">
      <div
        class={`
          shrink-0 text-[13px] leading-[13px] tracking-[-0.04px]
          text-v2-text-text-base [font-weight:530]
        `}
      >
        {props.language.t("home.sessions.empty")}
      </div>
      <p
        class={`
          mb-1 text-center text-[13px] leading-5 tracking-[-0.04px]
          text-v2-text-text-muted [font-weight:440]
        `}
      >
        {props.language.t("home.sessions.empty.description")}
      </p>
      <Show when={props.onNewSession}>
        {(onNewSession) => (
          <ButtonV2 data-action="home-new-session" variant="neutral" size="normal" icon="edit" onClick={onNewSession()}>
            {props.language.t("command.session.new")}
          </ButtonV2>
        )}
      </Show>
    </div>
  )
}

function HomeSessionSkeleton(props: { label: string }) {
  return (
    <div class="flex min-w-0 flex-col gap-4">
      <div class="flex h-7 min-w-0 items-center justify-between px-4">
        <div class={HOME_SECTION_LABEL}>{props.label}</div>
      </div>
      <div class="flex min-w-0 flex-col gap-px" aria-hidden="true">
        <For each={[0, 1, 2, 3]}>{() => <div class="h-10 rounded-[6px] bg-v2-background-bg-deep opacity-70" />}</For>
      </div>
    </div>
  )
}
