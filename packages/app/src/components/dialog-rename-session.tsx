import { ButtonV2 } from "@opencode-ai/ui/v2/button-v2"
import { Dialog, DialogFooter, DialogHeader, DialogTitle } from "@opencode-ai/ui/v2/dialog-v2"
import { TextInputV2 } from "@opencode-ai/ui/v2/text-input-v2"
import { createSignal } from "solid-js"
import { useDialog } from "@opencode-ai/ui/context/dialog"
import { useLanguage } from "@/context/language"
import { errorMessage } from "@/pages/layout/helpers"
import { showToast } from "@/utils/toast"

export function DialogRenameSession(props: {
  initialTitle: string
  onSubmit: (title: string) => Promise<void>
}) {
  const dialog = useDialog()
  const language = useLanguage()
  const [draft, setDraft] = createSignal(props.initialTitle)
  const [saving, setSaving] = createSignal(false)

  const submit = async () => {
    const title = draft().trim()
    if (!title || saving()) return
    setSaving(true)
    try {
      await props.onSubmit(title)
      dialog.close()
    } catch (err) {
      showToast({
        title: language.t("common.requestFailed"),
        description: errorMessage(err, language.t("common.requestFailed")),
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog fit>
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
              void submit()
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
        <ButtonV2 variant="contrast" disabled={!draft().trim() || saving()} onClick={() => void submit()}>
          {language.t("common.save")}
        </ButtonV2>
      </DialogFooter>
    </Dialog>
  )
}
