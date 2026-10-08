import { Show } from "solid-js"
import { useLanguage } from "@/context/language"
import { useServer } from "@/context/server"
import { useServerSDK } from "@/context/server-sdk"

export function ReconnectIndicatorV2() {
  const sdk = useServerSDK()
  const server = useServer()
  const language = useLanguage()
  const stream = () => sdk().stream()

  return (
    <Show when={stream().state !== "live"}>
      <button
        type="button"
        data-component="reconnect-indicator-v2"
        class="shrink-0 h-6 px-2 rounded-md bg-surface-base hover:bg-surface-raised-base-hover transition-colors text-11-regular text-text-weak"
        title={
          stream().state === "retry"
            ? language.t("app.server.unreachable", { server: server.name || server.key })
            : undefined
        }
        onClick={() => sdk().retryNow()}
      >
        {language.t("app.server.retrying")}
      </button>
    </Show>
  )
}
