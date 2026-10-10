import { writeClipboard } from "@opencode-ai/session-ui/clipboard"
import { useLanguage } from "@/context/language"
import {
  downloadSessionExport,
  fetchSessionExport,
  sessionExportFilename,
  type SessionExportClient,
} from "@/utils/session-export"
import { showToast } from "@/utils/toast"

export type SessionActionsClient = {
  session: {
    share: (input: { sessionID: string; directory?: string }) => Promise<{ data?: { share?: { url?: string } } }>
    unshare: (input: { sessionID: string; directory?: string }) => Promise<unknown>
    get: SessionExportClient["session"]["get"]
    messages: SessionExportClient["session"]["messages"]
  }
}

export function useSessionShareExport() {
  const language = useLanguage()

  const copyShare = async (url: string, existing: boolean) => {
    if (!(await writeClipboard(url))) {
      showToast({
        title: language.t("toast.session.share.copyFailed.title"),
        variant: "error",
      })
      return
    }

    showToast({
      title: existing ? language.t("session.share.copy.copied") : language.t("toast.session.share.success.title"),
      description: language.t("toast.session.share.success.description"),
      variant: "success",
    })
  }

  const share = async (input: {
    sessionID: string
    directory?: string
    url?: string
    client: SessionActionsClient
  }) => {
    if (input.url) {
      await copyShare(input.url, true)
      return
    }

    const url = await input.client.session
      .share({ sessionID: input.sessionID, directory: input.directory })
      .then((res) => res.data?.share?.url)
      .catch(() => undefined)
    if (!url) {
      showToast({
        title: language.t("toast.session.share.failed.title"),
        description: language.t("toast.session.share.failed.description"),
        variant: "error",
      })
      return
    }

    await copyShare(url, false)
  }

  const unshare = async (input: { sessionID: string; directory?: string; client: SessionActionsClient }) => {
    await input.client.session
      .unshare({ sessionID: input.sessionID, directory: input.directory })
      .then(() =>
        showToast({
          title: language.t("toast.session.unshare.success.title"),
          description: language.t("toast.session.unshare.success.description"),
          variant: "success",
        }),
      )
      .catch(() =>
        showToast({
          title: language.t("toast.session.unshare.failed.title"),
          description: language.t("toast.session.unshare.failed.description"),
          variant: "error",
        }),
      )
  }

  const exportSession = async (input: { sessionID: string; directory?: string; client: SessionActionsClient }) => {
    try {
      const data = await fetchSessionExport({
        sessionID: input.sessionID,
        directory: input.directory,
        client: input.client,
      })
      const filename = sessionExportFilename(data.info)
      downloadSessionExport(filename, data)
      showToast({
        variant: "success",
        icon: "circle-check",
        title: language.t("toast.session.export.success.title"),
        description: language.t("toast.session.export.success.description", { filename }),
      })
    } catch (err) {
      showToast({
        variant: "error",
        title: language.t("toast.session.export.failed.title"),
        description: err instanceof Error ? err.message : language.t("toast.session.export.failed.description"),
      })
    }
  }

  return { share, unshare, exportSession }
}
