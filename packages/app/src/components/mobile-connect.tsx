import { Button } from "@opencode-ai/ui/button"
import { createStore } from "solid-js/store"
import { useLanguage } from "@/context/language"
import { usePlatform } from "@/context/platform"
import { ServerConnection, useServer } from "@/context/server"
import { probeServer, validateMobileServerInput } from "@/utils/server-probe"
import { DEFAULT_USERNAME, ServerForm, useDefaultServer } from "./dialog-select-server"

export function MobileConnect() {
  const language = useLanguage()
  const platform = usePlatform()
  const server = useServer()
  const { setDefault } = useDefaultServer()
  const [state, setState] = createStore({
    url: "http://",
    name: "",
    username: DEFAULT_USERNAME,
    password: "",
    busy: false,
    error: "",
  })

  const submit = async () => {
    if (state.busy) return
    const input = validateMobileServerInput(state.url)
    if (!input.ok) {
      setState("error", language.t("dialog.server.add.error"))
      return
    }

    const http: ServerConnection.HttpBase = { url: input.url }
    if (state.username.trim()) http.username = state.username.trim()
    if (state.password) http.password = state.password

    setState({ busy: true, error: "" })
    const result = await probeServer(http)
    if (result.kind === "unreachable") {
      setState({ busy: false, error: language.t("error.serverSync.connectFailed", { url: input.url }) })
      return
    }
    if (result.kind === "unauthorized" || result.kind === "invalid") {
      setState({ busy: false, error: language.t("dialog.server.add.error") })
      return
    }

    const conn: ServerConnection.Http = { type: "http", http }
    if (state.name.trim()) conn.displayName = state.name.trim()
    server.add(conn)
    await setDefault(ServerConnection.key(conn))

    // The whole app reads the default server from storage on boot. If that
    // write silently failed, reloading would land back on this screen forever,
    // so surface the failure and keep the form filled instead.
    const stored = await platform.getDefaultServer?.()
    if (!stored || stored !== ServerConnection.key(conn)) {
      setState({ busy: false, error: language.t("dialog.server.add.error") })
      return
    }
    window.location.reload()
  }

  return (
    <div class="h-dvh w-screen flex flex-col items-center justify-center bg-background-base p-6">
      <div class="w-full max-w-md flex flex-col gap-4">
        <div class="flex flex-col gap-1">
          <h1 class="text-16-medium text-text-strong">{language.t("dialog.server.add.title")}</h1>
          <p class="text-12-regular text-text-weak">{language.t("dialog.server.description")}</p>
        </div>
        <ServerForm
          value={state.url}
          name={state.name}
          username={state.username}
          password={state.password}
          placeholder={language.t("dialog.server.add.placeholder")}
          busy={state.busy}
          error={state.error}
          status={undefined}
          onChange={(value) => setState("url", value)}
          onNameChange={(value) => setState("name", value)}
          onUsernameChange={(value) => setState("username", value)}
          onPasswordChange={(value) => setState("password", value)}
          onSubmit={() => void submit()}
          onBack={() => undefined}
        />
        <Button disabled={state.busy} onClick={() => void submit()}>
          {state.busy ? language.t("dialog.server.add.checking") : language.t("common.connect")}
        </Button>
      </div>
    </div>
  )
}
