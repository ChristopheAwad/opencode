import Drawer from "@corvu/drawer"
import { Show, type JSX } from "solid-js"

export function MobileSheet(props: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title?: string
  children: JSX.Element
}) {
  return (
    <Drawer
      open={props.open}
      onOpenChange={props.onOpenChange}
      side="bottom"
      handleScrollableElements
      closeOnOutsidePointerStrategy="pointerdown"
      modal
    >
      <Drawer.Portal>
        <Drawer.Overlay class="fixed inset-0 z-[100] bg-v2-overlay-simple-overlay-scrim opacity-0 backdrop-blur-none transition-[opacity,backdrop-filter] duration-300 data-[opening]:opacity-100 data-[opening]:backdrop-blur-[4px] data-[closing]:opacity-0 data-[closing]:backdrop-blur-none" />
        <Drawer.Content
          data-component="mobile-sheet"
          class="fixed inset-x-0 bottom-0 z-[100] flex max-h-[85dvh] flex-col rounded-t-[12px] bg-v2-background-bg-base pb-[env(safe-area-inset-bottom)] shadow-[var(--v2-elevation-overlay)] outline-none transition-transform duration-300"
        >
          <div aria-hidden="true" class="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-border-weak-base" />
          <Show when={props.title}>
            <Drawer.Label class="shrink-0 px-4 pt-2 text-14-regular text-v2-text-text-muted">{props.title}</Drawer.Label>
          </Show>
          <div class="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pt-2 pb-4">{props.children}</div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer>
  )
}
