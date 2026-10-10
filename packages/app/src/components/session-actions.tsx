import type { Accessor } from "solid-js"
import { createMemo, For } from "solid-js"
import { useDialog } from "@opencode-ai/ui/context/dialog"
import { DialogDeleteSession } from "@/components/dialog-delete-session"
import { DialogRenameSession } from "@/components/dialog-rename-session"
import { MobileSheet } from "@/components/mobile-sheet"
import { useLanguage } from "@/context/language"
import { useSessionShareExport, type SessionActionsClient } from "@/pages/session/session-share-export"

export type SessionActionId = "rename" | "share" | "export" | "archive" | "delete" | "new"

export type SessionAction = {
  id: SessionActionId
  label: string
  disabled?: boolean
  onSelect: () => void
}

export function useSessionActions(input: {
  sessionID: Accessor<string | undefined>
  directory: Accessor<string | undefined>
  shareEnabled: Accessor<boolean>
  shareUrl: Accessor<string | undefined>
  shareClient: Accessor<SessionActionsClient | undefined>
  name: Accessor<string | undefined>
  archive: (sessionID: string) => void
  archiving: Accessor<boolean>
  rename: (sessionID: string, title: string) => Promise<void>
  remove: (sessionID: string) => Promise<boolean>
  newSession: () => void
}) {
  const dialog = useDialog()
  const language = useLanguage()
  const sharing = useSessionShareExport()

  return createMemo<SessionAction[]>(() => {
    const id = input.sessionID()
    if (!id) return []

    const actions: SessionAction[] = [
      {
        id: "rename",
        label: language.t("common.rename"),
        onSelect: () =>
          dialog.show(() => (
            <DialogRenameSession
              initialTitle={input.name() ?? ""}
              onSubmit={(title) => input.rename(id, title)}
            />
          )),
      },
    ]

    if (input.shareEnabled()) {
      actions.push({
        id: "share",
        label: language.t("session.share.action.share"),
        onSelect: () => {
          const client = input.shareClient()
          if (!client) return
          void sharing.share({
            sessionID: id,
            directory: input.directory(),
            url: input.shareUrl(),
            client,
          })
        },
      })
    }

    actions.push(
      {
        id: "export",
        label: language.t("common.export"),
        onSelect: () => {
          const client = input.shareClient()
          if (!client) return
          void sharing.exportSession({ sessionID: id, directory: input.directory(), client })
        },
      },
      {
        id: "archive",
        label: language.t("common.archive"),
        disabled: input.archiving(),
        onSelect: () => input.archive(id),
      },
      {
        id: "delete",
        label: language.t("common.delete"),
        onSelect: () =>
          dialog.show(() => (
            <DialogDeleteSession name={input.name()} onDelete={() => input.remove(id)} />
          )),
      },
      {
        id: "new",
        label: language.t("command.session.new"),
        onSelect: () => input.newSession(),
      },
    )

    return actions
  })
}

export function SessionActionsSheet(props: {
  open: boolean
  onOpenChange: (open: boolean) => void
  actions: Accessor<SessionAction[]>
}) {
  const language = useLanguage()
  return (
    <MobileSheet open={props.open} onOpenChange={props.onOpenChange} title={language.t("common.moreOptions")}>
      <div class="flex flex-col">
        <For each={props.actions()}>
          {(action) => (
            <button
              type="button"
              data-action={`session-action-${action.id}`}
              disabled={action.disabled}
              class="flex h-12 w-full items-center rounded-md px-3 text-start text-14-regular text-text-strong hover:bg-surface-raised-base-hover disabled:opacity-50"
              onClick={() => {
                props.onOpenChange(false)
                action.onSelect()
              }}
            >
              {action.label}
            </button>
          )}
        </For>
      </div>
    </MobileSheet>
  )
}
