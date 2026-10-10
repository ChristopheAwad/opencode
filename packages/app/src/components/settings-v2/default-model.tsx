import { ButtonV2 } from "@opencode-ai/ui/v2/button-v2"
import { createSignal, Show, type Component } from "solid-js"
import type { ModelSelection } from "@/context/local"
import { useLanguage } from "@/context/language"
import { useModels } from "@/context/models"
import { useServerProtocol } from "@/context/server-sdk"
import { useServerSync } from "@/context/server-sync"
import { resolveDefaultModel } from "@/hooks/provider-catalog"
import { showToast } from "@/utils/toast"
import { ModelList } from "../dialog-select-model"
import { saveDefaultModel } from "./default-model-behavior"
import { SettingsListV2 } from "./parts/list"
import { SettingsRowV2 } from "./parts/row"

export const SettingsDefaultModelV2: Component = () => {
  const language = useLanguage()
  const models = useModels()
  const serverSync = useServerSync()
  const protocol = useServerProtocol()
  const selection = createDefaultModelSelection()
  const [open, setOpen] = createSignal(false)

  const label = () => {
    if (!models.ready()) return language.t("command.model.choose")
    const item = selection.current()
    if (item) return item.name
    const raw = serverSync().data.config.model
    return raw && raw.trim() ? raw : language.t("command.model.choose")
  }

  return (
    <Show when={protocol() === "v1"}>
      <div class="settings-v2-section" data-component="settings-models-default">
        <SettingsListV2>
          <SettingsRowV2
            title={language.t("settings.models.defaultModel.title")}
            description={language.t("settings.models.defaultModel.description")}
          >
            <ButtonV2
              data-action="settings-default-model"
              variant="outline"
              size="small"
              aria-expanded={open()}
              aria-controls="settings-default-model-list"
              disabled={serverSync().data.reload === "pending"}
              onClick={() => setOpen(!open())}
            >
              {label()}
            </ButtonV2>
          </SettingsRowV2>
        </SettingsListV2>
        <Show when={open()}>
          <div
            id="settings-default-model-list"
            data-component="settings-default-model-list"
            class="flex max-h-[320px] min-h-0 flex-col overflow-hidden rounded-md border border-border-weak-base"
          >
            <ModelList model={selection} onSelect={() => setOpen(false)} class="p-1" />
          </div>
        </Show>
      </div>
    </Show>
  )
}

function createDefaultModelSelection(): ModelSelection {
  const language = useLanguage()
  const models = useModels()
  const serverSync = useServerSync()
  const protocol = useServerProtocol()

  const configured = () => resolveDefaultModel(undefined, serverSync().data.config.model)

  return {
    ready: models.ready,
    current: () => {
      const key = configured()
      if (!key) return
      return models.find(key)
    },
    recent: () => [],
    list: models.list,
    cycle: () => {},
    set: (item) => {
      if (!item) return
      const previous = serverSync().data.config.model
      void saveDefaultModel({
        protocol: protocol(),
        key: `${item.providerID}/${item.modelID}`,
        previous,
        set: (value) => serverSync().set("config", "model", value),
        update: (config) => serverSync().updateConfig(config),
        refresh: () => serverSync().refreshDirectories(),
        onError: (error) => {
          const message = error instanceof Error ? error.message : String(error)
          showToast({ title: language.t("common.requestFailed"), description: message })
        },
      })
    },
    visible: models.visible,
    setVisibility: models.setVisibility,
    variant: {
      configured: () => undefined,
      selected: () => undefined,
      current: () => undefined,
      list: () => [],
      set: () => {},
      cycle: () => {},
    },
  }
}
