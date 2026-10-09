import { useNavigate } from "@solidjs/router"
import { createSignal } from "solid-js"
import { produce } from "solid-js/store"
import { notifySessionTabsRemoved } from "@/components/titlebar-session-events"
import { useLanguage } from "@/context/language"
import { useSDK } from "@/context/sdk"
import { useServerSync } from "@/context/server-sync"
import { useSync } from "@/context/sync"
import { useTabs } from "@/context/tabs"
import { errorMessage } from "@/pages/layout/helpers"
import { useSessionKey } from "@/pages/session/session-layout"
import { legacySessionHref, requireServerKey, sessionHref } from "@/utils/session-route"
import { showToast } from "@/utils/toast"

// Shared across useSessionArchive() instances: the mobile header, the command
// palette, and the session page each call the hook, and all must see the same
// in-flight archive actions. Keyed by session ID so different sessions can
// archive concurrently.
const [archiving, setArchiving] = createSignal<ReadonlySet<string>>(new Set())

export function useSessionArchive() {
  const language = useLanguage()
  const navigate = useNavigate()
  const sdk = useSDK()
  const sync = useSync()
  const serverSync = useServerSync()
  const tabs = useTabs()
  const { params } = useSessionKey()
  const archivingIDs = () => archiving()
  const markArchiving = (sessionID: string, value: boolean) =>
    setArchiving((current) => {
      const next = new Set(current)
      if (value) next.add(sessionID)
      else next.delete(sessionID)
      return next
    })

  const navigateAfterRemoval = (sessionID: string, parentID?: string, nextSessionID?: string) => {
    if (params.id !== sessionID) return
    const href = (id: string) =>
      params.serverKey ? sessionHref(requireServerKey(params.serverKey), id) : legacySessionHref(sdk().directory, id)
    if (parentID) {
      navigate(href(parentID))
      return
    }
    if (nextSessionID) {
      navigate(href(nextSessionID))
      return
    }
    if (params.serverKey) {
      tabs.newDraft({ server: requireServerKey(params.serverKey), directory: sdk().directory })
      return
    }
    navigate(`/${params.dir}/session`)
  }

  const archive = async (sessionID: string) => {
    if (archivingIDs().has(sessionID)) return
    const session = sync().session.get(sessionID)
    if (!session) return
    markArchiving(sessionID, true)
    try {
      if ((await sdk().protocol) !== "v1") return

      const sessions = sync().data.session ?? []
      const index = sessions.findIndex((s) => s.id === sessionID)
      const nextSession = index === -1 ? undefined : (sessions[index + 1] ?? sessions[index - 1])

      await sdk()
        .client.session.update({ sessionID, directory: sdk().directory, time: { archived: Date.now() } })
        .then(() => {
          sync().set(
            produce((draft) => {
              const index = draft.session.findIndex((s) => s.id === sessionID)
              if (index !== -1) draft.session.splice(index, 1)
            }),
          )
          sync().session.evict(sessionID)
          serverSync().homeSessions.remove(sessionID)
          navigateAfterRemoval(sessionID, session.parentID, nextSession?.id)
          notifySessionTabsRemoved({ directory: sdk().directory, sessionIDs: [sessionID] })
        })
        .catch((err) => {
          showToast({
            title: language.t("common.requestFailed"),
            description: errorMessage(err, language.t("common.requestFailed")),
          })
        })
    } finally {
      markArchiving(sessionID, false)
    }
  }

  return {
    archive,
    archiving: (sessionID?: string) =>
      sessionID === undefined ? archivingIDs().size > 0 : archivingIDs().has(sessionID),
    navigateAfterRemoval,
  }
}
