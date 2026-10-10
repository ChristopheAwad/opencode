import { ButtonV2 } from "@opencode-ai/ui/v2/button-v2"
import { KeybindV2 } from "@opencode-ai/ui/v2/keybind-v2"
import { TooltipV2 } from "@opencode-ai/ui/v2/tooltip-v2"
import { createMemo, createSignal, For, Show, type JSX } from "solid-js"
import type { PromptInputV2ComposerController } from "@/components/prompt-input-v2"
import { MobileSheet } from "@/components/mobile-sheet"
import { useLanguage } from "@/context/language"

export function MobileModelPicker(props: {
  title: string
  keybind: string[]
  content: JSX.Element
  animate?: boolean
  model: PromptInputV2ComposerController["model"]["selection"]
  onClose: () => void
}) {
  const language = useLanguage()
  const [open, setOpen] = createSignal(false)

  return (
    <>
      <TooltipV2
        placement="top"
        gutter={4}
        class="min-w-0 flex-1"
        value={
          <>
            {props.title}
            <KeybindV2 keys={props.keybind} variant="neutral" />
          </>
        }
      >
        <ButtonV2
          data-action="prompt-model"
          data-control-type="panel"
          variant="ghost-muted"
          size="normal"
          style={{ height: "36px" }}
          class="w-full min-w-0 max-w-none justify-start ![font-weight:440] group"
          classList={{ "animate-in fade-in": props.animate ?? false }}
          onClick={() => setOpen(true)}
        >
          {props.content}
        </ButtonV2>
      </TooltipV2>
      <MobileSheet
        open={open()}
        onOpenChange={(next) => {
          setOpen(next)
          if (!next) props.onClose()
        }}
        title={language.t("dialog.model.select.title")}
      >
        <NativeModelPanel selection={props.model} onSelect={() => setOpen(false)} />
      </MobileSheet>
    </>
  )
}

function NativeModelPanel(props: {
  selection: PromptInputV2ComposerController["model"]["selection"]
  onSelect: () => void
}) {
  const language = useLanguage()
  const [search, setSearch] = createSignal("")
  const models = createMemo(() => {
    const query = search().trim().toLowerCase()
    return props.selection
      .list()
      .filter((item) => props.selection.visible({ modelID: item.id, providerID: item.provider.id }))
      .filter((item) => !query || `${item.name} ${item.id} ${item.provider.name}`.toLowerCase().includes(query))
      .sort((a, b) => a.name.localeCompare(b.name))
  })
  const isCurrent = (item: { id: string; provider: { id: string } }) => {
    const current = props.selection.current()
    return !!current && current.id === item.id && current.provider.id === item.provider.id
  }
  const variants = createMemo(() => ["default", ...props.selection.variant.list()])
  const currentVariant = () => props.selection.variant.current() ?? "default"

  return (
    <div
      data-component="native-model-panel"
      class="flex max-h-[70vh] flex-col gap-4 overflow-y-auto overscroll-contain"
    >
      <section class="flex flex-col gap-2">
        <input
          type="search"
          value={search()}
          onInput={(event) => setSearch(event.currentTarget.value)}
          placeholder={language.t("dialog.model.search.placeholder")}
          aria-label={language.t("dialog.model.search.placeholder")}
          class="h-10 w-full shrink-0 rounded-md border border-border-weak-base bg-surface-panel px-3 text-14-regular text-text-strong outline-none placeholder:text-text-weak"
        />
        <div class="max-h-[40vh] overflow-y-auto">
          <For each={models()}>
            {(item) => (
              <button
                type="button"
                data-action="native-model-option"
                aria-pressed={isCurrent(item)}
                class="flex w-full items-center justify-between gap-2 rounded-md px-3 py-3 text-start text-14-regular text-text-strong hover:bg-surface-raised-base-hover"
                classList={{ "bg-surface-raised-base-hover": isCurrent(item) }}
                onClick={() => {
                  props.selection.set({ modelID: item.id, providerID: item.provider.id }, { recent: true })
                  props.onSelect()
                }}
              >
                <span class="min-w-0 truncate">{item.name}</span>
                <span class="shrink-0 text-12-regular text-text-weak">{item.provider.name}</span>
              </button>
            )}
          </For>
          <Show when={models().length === 0}>
            <p class="px-3 py-4 text-14-regular text-text-weak">{language.t("dialog.model.empty")}</p>
          </Show>
        </div>
      </section>
      <Show when={variants().length > 1}>
        <section class="flex flex-col gap-1">
          <div class="px-1 text-12-regular text-text-weak">{language.t("command.model.variant.cycle")}</div>
          <div class="flex flex-wrap gap-1">
            <For each={variants()}>
              {(value) => (
                <button
                  type="button"
                  data-action="native-variant-option"
                  data-variant={value}
                  aria-pressed={currentVariant() === value}
                  class="rounded-md border border-border-weak-base px-3 py-2 text-13-regular text-text-base"
                  classList={{ "bg-surface-raised-base-hover text-text-strong": currentVariant() === value }}
                  onClick={() => {
                    props.selection.variant.set(value === "default" ? undefined : value)
                    props.onSelect()
                  }}
                >
                  {value}
                </button>
              )}
            </For>
          </div>
        </section>
      </Show>
    </div>
  )
}
