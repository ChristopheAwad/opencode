import { For } from "solid-js"
import { useDialog } from "@opencode-ai/ui/context/dialog"
import { Icon as IconV2 } from "@opencode-ai/ui/v2/icon"
import { useCommand } from "@/context/command"
import { useLanguage } from "@/context/language"
import { useLayout } from "@/context/layout"
import { DialogSelectServer } from "@/components/dialog-select-server"
import { ReconnectIndicatorV2 } from "@/components/reconnect-indicator"

type MobileNavItem = {
  key: string
  icon: string
  label: string
  active: boolean
  onSelect: () => void
}

export function MobileNav() {
  const command = useCommand()
  const dialog = useDialog()
  const language = useLanguage()
  const layout = useLayout()

  const items = (): MobileNavItem[] => [
    {
      key: "home",
      icon: "grid-plus",
      label: language.t("home.title"),
      active: layout.route().type === "home",
      onSelect: () => command.trigger("home.toggle"),
    },
    {
      key: "search",
      icon: "magnifying-glass",
      label: language.t("command.palette"),
      active: false,
      onSelect: () => command.show(),
    },
    {
      key: "new",
      icon: "plus",
      label: language.t("command.session.new"),
      active: layout.route().type === "draft",
      onSelect: () => command.trigger("tab.new"),
    },
    {
      key: "servers",
      icon: "workspace",
      label: language.t("command.server.switch"),
      active: false,
      onSelect: () => dialog.show(() => <DialogSelectServer />),
    },
  ]

  return (
    <nav data-component="mobile-nav" class="relative z-30 shrink-0 border-t border-border-weak-base bg-v2-background-bg-deep">
      <div class="pointer-events-none absolute inset-x-0 bottom-full flex justify-center pb-2">
        <div class="pointer-events-auto">
          <ReconnectIndicatorV2 />
        </div>
      </div>
      <div class="flex h-14 items-stretch justify-around px-1">
        <For each={items()}>
          {(item) => (
            <button
              type="button"
              data-action={`mobile-nav-${item.key}`}
              aria-label={item.label}
              aria-current={item.active ? "page" : undefined}
              class="flex min-w-0 flex-1 flex-col items-center justify-center rounded-lg transition-colors"
              classList={{
                "text-v2-text-text-base bg-v2-overlay-simple-overlay-hover": item.active,
                "text-v2-text-text-muted hover:bg-v2-overlay-simple-overlay-hover": !item.active,
              }}
              onClick={item.onSelect}
            >
              <IconV2 name={item.icon} class="size-5" />
            </button>
          )}
        </For>
      </div>
    </nav>
  )
}
