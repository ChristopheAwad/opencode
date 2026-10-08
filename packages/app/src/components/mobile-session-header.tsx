import { createMemo, Show } from "solid-js"
import { Icon } from "@opencode-ai/ui/icon"
import { MenuV2 } from "@opencode-ai/ui/v2/menu-v2"
import { Icon as IconV2 } from "@opencode-ai/ui/v2/icon"
import { IconButtonV2 } from "@opencode-ai/ui/v2/icon-button-v2"
import { SessionProgressIndicatorV2 } from "@opencode-ai/session-ui/v2/session-progress-indicator-v2"
import { useCommand } from "@/context/command"
import { useLanguage } from "@/context/language"
import { useSync } from "@/context/sync"
import { useSessionLayout } from "@/pages/session/session-layout"
import { sessionTitle } from "@/utils/session-title"

export function MobileSessionHeader(props: {
  active: "session" | "changes"
  changesLabel: string
  onSelect: (tab: "session" | "changes") => void
}) {
  const command = useCommand()
  const language = useLanguage()
  const sync = useSync()
  const { params } = useSessionLayout()

  const title = createMemo(
    () =>
      sessionTitle(params.id ? sync().session.get(params.id)?.title : undefined)?.trim() ||
      language.t("command.session.new"),
  )
  const working = createMemo(() => !!params.id && sync().data.session_working(params.id))
  const shareEnabled = createMemo(() => sync().data.config.share !== "disabled")

  return (
    <header
      data-component="mobile-session-header"
      class="shrink-0 h-12 flex items-center gap-1.5 border-b border-border-weak-base bg-v2-background-bg-deep px-2"
    >
      <IconButtonV2
        data-action="mobile-session-back"
        variant="ghost-muted"
        size="large"
        aria-label={language.t("common.goBack")}
        icon={<Icon name="arrow-left" size="small" />}
        onClick={() => command.trigger("home.toggle")}
      />
      <h1
        data-slot="mobile-session-title"
        title={title()}
        class="min-w-0 flex-1 truncate text-14-regular text-v2-text-text-base"
      >
        {title()}
      </h1>
      <Show when={working()}>
        <span class="shrink-0 flex size-5 items-center justify-center">
          <SessionProgressIndicatorV2 class="size-4" />
        </span>
      </Show>
      <div class="shrink-0 flex items-center gap-0.5 rounded-lg border border-border-weak-base p-0.5">
        <button
          type="button"
          data-action="mobile-session-tab-session"
          aria-pressed={props.active === "session"}
          class="h-7 rounded-md px-2 text-12-regular transition-colors"
          classList={{
            "bg-v2-overlay-simple-overlay-hover text-v2-text-text-base": props.active === "session",
            "text-v2-text-text-muted": props.active !== "session",
          }}
          onClick={() => props.onSelect("session")}
        >
          {language.t("session.tab.session")}
        </button>
        <button
          type="button"
          data-action="mobile-session-tab-changes"
          aria-pressed={props.active === "changes"}
          class="h-7 rounded-md px-2 text-12-regular transition-colors"
          classList={{
            "bg-v2-overlay-simple-overlay-hover text-v2-text-text-base": props.active === "changes",
            "text-v2-text-text-muted": props.active !== "changes",
          }}
          onClick={() => props.onSelect("changes")}
        >
          {props.changesLabel}
        </button>
      </div>
      <MenuV2 gutter={6} placement="bottom-end">
        <MenuV2.Trigger
          as={IconButtonV2}
          icon={<IconV2 name="outline-dots" />}
          variant="ghost-muted"
          size="large"
          aria-label={language.t("common.moreOptions")}
        />
        <MenuV2.Portal>
          <MenuV2.Content style={{ width: "160px", "min-width": "160px" }}>
            <Show when={shareEnabled()}>
              <MenuV2.Item onSelect={() => command.trigger("session.share")}>
                {language.t("session.share.action.share")}
              </MenuV2.Item>
            </Show>
            <MenuV2.Item onSelect={() => command.trigger("session.export")}>{language.t("common.export")}</MenuV2.Item>
            <MenuV2.Item onSelect={() => command.trigger("session.archive")}>
              {language.t("common.archive")}
            </MenuV2.Item>
            <MenuV2.Separator />
            <MenuV2.Item onSelect={() => command.trigger("session.new")}>
              {language.t("command.session.new")}
            </MenuV2.Item>
          </MenuV2.Content>
        </MenuV2.Portal>
      </MenuV2>
    </header>
  )
}
