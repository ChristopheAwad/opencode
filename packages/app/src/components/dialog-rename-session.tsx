import { createSignal } from "solid-js"
import { useMutation } from "@tanstack/solid-query"
import { useDialog } from "@opencode-ai/ui/context/dialog"
import { DialogV2, DialogFooter, DialogHeader, DialogTitle } from "@opencode-ai/ui/v2/dialog-v2"
import { ButtonV2 } from "@opencode-ai/ui/v2/button-v2"
import { TextInputV2 } from "@opencode-ai/ui/v2/text-input-v2"
import { useLanguage } from "@/context/language"
import { useSDK } from "@/context/sdk"
import { useSync } from "@/context/sync"
import { errorMessage } from "@/pages/layout/helpers"
import { showToast } from "@/utils/toast"

export function DialogRenameSession(props: { sessionID: string }) {
  const dialog = useDialog()
  const language = useLanguage()
  const sdk = useSDK()
  const sync = useSync()
  const [draft, setDraft] = createSignal(sync().session.get(props.sessionID)?.title ?? "")

  const rename = useMutation(() => ({
    mutationFn: (title: string) => sdk().api.session.rename({ sessionID: props.sessionID, title }),
    onSuccess: (_, title) => {
      const current = sync().session.get(props.sessionID)
      if (current) sync().session.remember({ ...current, title })
      dialog.close()
    },
    onError: (err) => {
      showToast({
        title: language.t("common.requestFailed"),
        description: errorMessage(err, language.t("common.requestFailed")),
      })
    },
  }))

  const submit = () => {
    const title = draft().trim()
    if (!title || rename.isPending) return
    rename.mutate(title)
  }

  return (
    <DialogV2 fit>
      <DialogHeader>
        <DialogTitle>{language.t("common.rename")}</DialogTitle>
      </DialogHeader>
      <div class="px-6 pb-2">
        <TextInputV2
          aria-label={language.t("common.rename")}
          appearance="large"
          class="!w-full"
          autofocus
          value={draft()}
          onInput={(event) => setDraft(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.isComposing || event.keyCode === 229) return
            if (event.key === "Enter") {
              event.preventDefault()
              submit()
              return
            }
            if (event.key === "Escape") {
              event.preventDefault()
              dialog.close()
            }
          }}
        />
      </div>
      <DialogFooter>
        <ButtonV2 variant="neutral" onClick={() => dialog.close()}>
          {language.t("common.cancel")}
        </ButtonV2>
        <ButtonV2 variant="contrast" disabled={!draft().trim() || rename.isPending} onClick={submit}>
          {language.t("common.save")}
        </ButtonV2>
      </DialogFooter>
    </DialogV2>
  )
}
