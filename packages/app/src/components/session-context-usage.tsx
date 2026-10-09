import { Match, Show, Switch, createMemo, type Accessor, type ComponentProps, type JSX } from "solid-js"
import { ProgressCircle } from "@opencode-ai/ui/progress-circle"
import { ProgressCircleV2 } from "@opencode-ai/ui/v2/progress-circle-v2"
import { Button } from "@opencode-ai/ui/button"
import { ButtonV2 } from "@opencode-ai/ui/v2/button-v2"
import { useDialog } from "@opencode-ai/ui/context/dialog"
import { DialogBody, DialogFooter, DialogHeader, DialogTitle, DialogV2 } from "@opencode-ai/ui/v2/dialog-v2"
import { IconButtonV2 } from "@opencode-ai/ui/v2/icon-button-v2"
import { TooltipV2 } from "@opencode-ai/ui/v2/tooltip-v2"
import { createMediaQuery } from "@solid-primitives/media"

import { useFile } from "@/context/file"
import { useLayout } from "@/context/layout"
import { useSync } from "@/context/sync"
import { useLanguage } from "@/context/language"
import { useProviders } from "@/hooks/use-providers"
import { useSDK } from "@/context/sdk"
import { getSessionContext } from "@/components/session/session-context-metrics"
import { createSessionContextFormatter } from "@/components/session/session-context-format"
import { useSessionLayout } from "@/pages/session/session-layout"
import { createSessionTabs } from "@/pages/session/helpers"
import { useSettings } from "@/context/settings"
import { isNativeShell } from "@/utils/native-platform"

interface SessionContextUsageProps {
  variant?: "button" | "indicator"
  buttonAppearance?: "default" | "v2"
  placement?: ComponentProps<typeof TooltipV2>["placement"]
}

function ContextTooltipRow(props: { name: JSX.Element; value: JSX.Element }) {
  return (
    <div class="flex min-w-0 items-center gap-4">
      <span class="shrink-0 text-v2-text-text-muted">{props.name}</span>
      <span class="ml-auto min-w-0 truncate text-right text-v2-text-text-base">{props.value}</span>
    </div>
  )
}

function ContextUsageDialog(props: {
  context: Accessor<ReturnType<typeof getSessionContext>>
  cost: Accessor<string>
}) {
  const dialog = useDialog()
  const language = useLanguage()
  const format = createSessionContextFormatter(language.intl())

  return (
    <DialogV2 fit>
      <DialogHeader hideClose>
        <DialogTitle>{language.t("context.usage.view")}</DialogTitle>
      </DialogHeader>
      <DialogBody class="flex w-[260px] max-h-[60vh] flex-col gap-2 overflow-y-auto px-6 pb-2">
        <ContextTooltipRow name={language.t("context.stats.model")} value={props.context()?.modelLabel ?? "—"} />
        <ContextTooltipRow
          name={language.t("context.stats.limit")}
          value={format.number(props.context()?.limit)}
        />
        <ContextTooltipRow name={language.t("context.stats.usage")} value={format.percent(props.context()?.usage)} />
        <ContextTooltipRow name={language.t("context.usage.cost")} value={props.cost()} />
        <ContextTooltipRow
          name={language.t("context.stats.inputTokens")}
          value={format.number(props.context()?.input)}
        />
        <ContextTooltipRow
          name={language.t("context.stats.outputTokens")}
          value={format.number(props.context()?.message.tokens.output)}
        />
        <ContextTooltipRow
          name={language.t("context.stats.reasoningTokens")}
          value={format.number(props.context()?.message.tokens.reasoning)}
        />
        <ContextTooltipRow
          name={language.t("context.stats.cacheTokens")}
          value={`${format.number(props.context()?.message.tokens.cache.read)} / ${format.number(
            props.context()?.message.tokens.cache.write,
          )}`}
        />
        <ContextTooltipRow
          name={language.t("context.stats.totalTokens")}
          value={format.number(props.context()?.total)}
        />
      </DialogBody>
      <DialogFooter>
        <ButtonV2 variant="neutral" onClick={() => dialog.close()}>
          {language.t("common.close")}
        </ButtonV2>
      </DialogFooter>
    </DialogV2>
  )
}

function openSessionContext(args: {
  view: ReturnType<ReturnType<typeof useLayout>["view"]>
  layout: ReturnType<typeof useLayout>
  tabs: ReturnType<ReturnType<typeof useLayout>["tabs"]>
}) {
  args.view.reviewPanel.open(args.view.reviewPanel.opened() ? "other" : "context-button")
  if (args.layout.fileTree.opened() && args.layout.fileTree.tab() !== "all") args.layout.fileTree.setTab("all")
  void args.tabs.open("context")
  args.tabs.setActive("context")
}

export function SessionContextUsage(props: SessionContextUsageProps) {
  const sync = useSync()
  const file = useFile()
  const layout = useLayout()
  const language = useLanguage()
  const sdk = useSDK()
  const settings = useSettings()
  const providers = useProviders(() => sdk().directory)
  const { params, tabs, view } = useSessionLayout()
  const isDesktop = createMediaQuery("(min-width: 768px)")
  const native = isNativeShell()
  const dialog = useDialog()

  const variant = createMemo(() => props.variant ?? "button")
  const buttonAppearance = createMemo(() => props.buttonAppearance ?? "default")
  const tabState = createSessionTabs({
    tabs,
    pathFromTab: file.pathFromTab,
    normalizeTab: (tab) => (tab.startsWith("file://") ? file.tab(tab) : tab),
    fileBrowser: () => settings.general.newLayoutDesigns() && isDesktop() && !!params.id,
  })
  const messages = createMemo(() => (params.id ? (sync().data.message[params.id] ?? []) : []))
  const info = createMemo(() => (params.id ? sync().session.get(params.id) : undefined))

  const usd = createMemo(
    () =>
      new Intl.NumberFormat(language.intl(), {
        style: "currency",
        currency: "USD",
      }),
  )

  const context = createMemo(() => getSessionContext(messages(), [...providers.all().values()]))
  const cost = createMemo(() => {
    return usd().format(info()?.cost ?? 0)
  })
  const contextVisible = createMemo(() => view().reviewPanel.opened() && tabState.activeTab() === "context")
  const hasOtherTabs = createMemo(() =>
    tabs()
      .all()
      .some((tab) => tab !== "context" && tab !== "review"),
  )

  const openContext = () => {
    if (!params.id) return

    const sessionView = view()
    if (contextVisible()) {
      tabs().close("context")
      if (sessionView.reviewPanel.source() === "context-button" && !hasOtherTabs()) sessionView.reviewPanel.close()
      return
    }

    openSessionContext({
      view: sessionView,
      layout,
      tabs: tabs(),
    })
  }

  const openNativeContext = () => {
    if (!params.id) return
    dialog.show(() => <ContextUsageDialog context={context} cost={cost} />)
  }

  const circle = () => (
    <div class="flex items-center justify-center">
      <ProgressCircle
        size={16}
        strokeWidth={2}
        percentage={context()?.usage ?? 0}
        style={
          variant() === "indicator"
            ? {
                "--progress-circle-background": "var(--v2-background-bg-layer-04, var(--border-weak-base))",
                "--progress-circle-background-overlay": "var(--v2-overlay-simple-overlay-pressed, transparent)",
                "--progress-circle-progress": "var(--v2-icon-icon-base, var(--icon-base))",
              }
            : undefined
        }
      />
    </div>
  )
  const circleV2 = () => (
    <div class="flex items-center justify-center">
      <ProgressCircleV2 percentage={context()?.usage ?? 0} />
    </div>
  )

  const tooltipValue = () => (
    <div class="flex w-[120px] flex-col gap-2">
      <ContextTooltipRow name={language.t("context.usage.cost")} value={cost()} />
      <ContextTooltipRow name={language.t("context.usage.usage")} value={`${context()?.usage ?? 0}%`} />
      <ContextTooltipRow
        name={language.t("context.usage.tokens")}
        value={context()?.total.toLocaleString(language.intl()) ?? "0"}
      />
    </div>
  )

  const trigger = (onClick: () => void) => (
    <Switch>
      <Match when={variant() === "indicator"}>{circle()}</Match>
      <Match when={buttonAppearance() === "v2"}>
        <IconButtonV2
          type="button"
          variant="ghost-muted"
          size="large"
          icon={circleV2()}
          onClick={onClick}
          aria-label={language.t("context.usage.view")}
        />
      </Match>
      <Match when={true}>
        <Button
          type="button"
          variant="ghost"
          class="size-6"
          onClick={onClick}
          aria-label={language.t("context.usage.view")}
        >
          {circle()}
        </Button>
      </Match>
    </Switch>
  )

  return (
    <Show when={params.id}>
      <Show when={!native} fallback={trigger(openNativeContext)}>
        <TooltipV2 value={tooltipValue()} placement={props.placement ?? "top"} shift={-8}>
          {trigger(openContext)}
        </TooltipV2>
      </Show>
    </Show>
  )
}
