import { createSignal } from "solid-js"
import { Button } from "@opencode-ai/ui/button"
import { Dialog } from "@opencode-ai/ui/dialog"
import { useDialog } from "@opencode-ai/ui/context/dialog"
import { DialogFooter, DialogHeader, DialogTitleGroup, DialogV2 } from "@opencode-ai/ui/v2/dialog-v2"
import { ButtonV2 } from "@opencode-ai/ui/v2/button-v2"
import { useLanguage } from "@/context/language"
import { useSettings } from "@/context/settings"

export function DialogDeleteSession(props: {
  name?: string
  onDelete: () => Promise<boolean>
}) {
  const dialog = useDialog()
  const language = useLanguage()
  const settings = useSettings()
  const [deleting, setDeleting] = createSignal(false)
  const name = () => props.name ?? language.t("command.session.new")

  const handleDelete = async () => {
    if (deleting()) return
    setDeleting(true)
    try {
      if (await props.onDelete()) dialog.close()
    } finally {
      setDeleting(false)
    }
  }

  if (settings.general.newLayoutDesigns())
    return (
      <DialogV2 fit>
        <DialogHeader hideClose>
          <DialogTitleGroup
            title={language.t("session.delete.title")}
            description={language.t("session.delete.confirm", { name: name() })}
          />
        </DialogHeader>
        <DialogFooter>
          <ButtonV2 variant="ghost" onClick={() => dialog.close()}>
            {language.t("common.cancel")}
          </ButtonV2>
          <ButtonV2 variant={deleting() ? "loading" : "danger"} disabled={deleting()} onClick={handleDelete}>
            {language.t("session.delete.button")}
          </ButtonV2>
        </DialogFooter>
      </DialogV2>
    )

  return (
    <Dialog title={language.t("session.delete.title")} fit>
      <div class="flex flex-col gap-4 pl-6 pr-2.5 pb-3">
        <div class="flex flex-col gap-1">
          <span class="text-14-regular text-text-strong">{language.t("session.delete.confirm", { name: name() })}</span>
        </div>
        <div class="flex justify-end gap-2">
          <Button variant="ghost" size="large" onClick={() => dialog.close()}>
            {language.t("common.cancel")}
          </Button>
          <Button variant="primary" size="large" disabled={deleting()} onClick={handleDelete}>
            {language.t("session.delete.button")}
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
