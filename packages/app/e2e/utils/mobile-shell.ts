import type { Page } from "@playwright/test"
import { mockOpenCodeServer, type MockServerConfig } from "./mock-server"

export const MOBILE_SERVER_URL = "http://127.0.0.1:4096"
export const DEFAULT_SERVER_KEY = "opencode.settings.dat:defaultServerUrl"

export async function installNativeShell(page: Page) {
  await page.addInitScript(() => {
    const listeners: Record<string, Array<(...args: unknown[]) => void>> = {}
    Object.assign(window, {
      __capacitorAppListeners: listeners,
      Capacitor: {
        isNativePlatform: () => true,
        Plugins: {
          App: {
            addListener: (event: string, callback: (...args: unknown[]) => void) => {
              const list = (listeners[event] ??= [])
              list.push(callback)
              return {
                remove: async () => {
                  const index = list.indexOf(callback)
                  if (index >= 0) list.splice(index, 1)
                },
              }
            },
          },
        },
      },
    })
  })
}

export async function emitNativeAppState(page: Page, isActive: boolean) {
  await page.evaluate((isActive) => {
    const listeners = (
      window as unknown as { __capacitorAppListeners?: Record<string, Array<(state: unknown) => void>> }
    ).__capacitorAppListeners
    for (const handler of [...(listeners?.appStateChange ?? [])]) handler({ isActive })
  }, isActive)
}

export async function seedMobileServer(
  page: Page,
  input: { directory: string; projects?: string[]; selected?: string | null },
) {
  const directories = input.projects ?? [input.directory]
  const selected = input.selected === undefined ? directories[0] : input.selected
  await page.addInitScript(
    (data) => {
      localStorage.setItem("settings.v3", JSON.stringify({ general: { newLayoutDesigns: true } }))
      localStorage.setItem(data.defaultServerKey, data.server)
      localStorage.setItem(
        "opencode.global.dat:server",
        JSON.stringify({
          list: [data.server],
          projects: { [data.server]: data.directories.map((worktree) => ({ worktree, expanded: true })) },
          lastProject: data.selected ? { [data.server]: data.selected } : {},
          recentlyClosed: {},
        }),
      )
    },
    {
      server: MOBILE_SERVER_URL,
      defaultServerKey: DEFAULT_SERVER_KEY,
      directories,
      selected: selected ?? null,
    },
  )
}

export function mockMobileServer(page: Page, config: Omit<MockServerConfig, "protocol"> & { protocol?: "v1" | "v2" }) {
  return mockOpenCodeServer(page, { protocol: "v2", ...config })
}
