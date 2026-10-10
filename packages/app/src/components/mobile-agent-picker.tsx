import { ButtonV2 } from "@opencode-ai/ui/v2/button-v2"
import { Icon } from "@opencode-ai/ui/v2/icon"
import { KeybindV2 } from "@opencode-ai/ui/v2/keybind-v2"
import { TooltipV2 } from "@opencode-ai/ui/v2/tooltip-v2"
import type { PromptInputV2SelectControl } from "@opencode-ai/session-ui/v2/prompt-input/interaction"
import { createSignal, For, Show } from "solid-js"
import { MobileSheet } from "@/components/mobile-sheet"
import { useLanguage } from "@/context/language"

export function MobileAgentPicker(props: { control: PromptInputV2SelectControl }) {
  const language = useLanguage()
  const [open, setOpen] = createSignal(false)
  const title = () => language.t("ui.promptInput.chooseAgent")
  const current = () =>
    props.control.options().find((option) => option.id === props.control.current())?.label ?? props.control.current()

  return (
    <Show when={props.control.options().length > 0}>
      <TooltipV2
        placement="top"
        gutter={4}
        class="min-w-0"
        value={
          <>
            {title()}
            <KeybindV2 keys={props.control.keybind?.() ?? []} variant="neutral" />
          </>
        }
      >
        <ButtonV2
          data-action="prompt-agent"
          data-control-type="panel"
          variant="ghost-muted"
          size="normal"
          aria-label={title()}
          class="min-w-0 max-w-[220px] justify-start ![font-weight:440] @max-[440px]:!px-1.5 @max-[440px]:!gap-[3px]"
          onClick={() => setOpen(true)}
        >
          <span class="truncate capitalize leading-5">{current()}</span>
          <span class="-ms-0.5 -me-1 flex shrink-0">
            <Icon name="chevron-down" />
          </span>
        </ButtonV2>
      </TooltipV2>
      <MobileSheet open={open()} onOpenChange={setOpen} title={title()}>
        <div class="flex flex-col">
          <For each={props.control.options()}>
            {(option) => (
              <button
                type="button"
                data-action="agent-option"
                aria-pressed={props.control.current() === option.id}
                class="flex h-12 w-full items-center rounded-md px-3 text-start text-14-regular capitalize text-text-strong hover:bg-surface-raised-base-hover"
                classList={{ "bg-surface-raised-base-hover": props.control.current() === option.id }}
                onClick={() => {
                  props.control.onSelect(option.id)
                  setOpen(false)
                }}
              >
                {option.label}
              </button>
            )}
          </For>
        </div>
      </MobileSheet>
    </Show>
  )
}
