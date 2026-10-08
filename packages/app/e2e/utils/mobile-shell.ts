import type { Page } from "@playwright/test"
import { mockOpenCodeServer, type MockServerConfig } from "./mock-server"

export const MOBILE_SERVER_URL = "http://127.0.0.1:4096"
export const DEFAULT_SERVER_KEY = "opencode.settings.dat:defaultServerUrl"

export async function installNativeShell(page: Page) {
  await page.addInitScript(() => {
    Object.assign(window, {
      Capacitor: {
        isNativePlatform: () => true,
        Plugins: { App: { addListener: () => ({ remove: async () => {} }) } },
      },
    })
  })
}

export async function seedMobileServer(page: Page, input: { directory: string; projects?: string[] }) {
  await page.addInitScript(
    (data) => {
      localStorage.setItem("settings.v3", JSON.stringify({ general: { newLayoutDesigns: true } }))
      localStorage.setItem(data.defaultServerKey, data.server)
      localStorage.setItem(
        "opencode.global.dat:server",
        JSON.stringify({
          list: [data.server],
          projects: { [data.server]: data.directories.map((worktree) => ({ worktree, expanded: true })) },
          lastProject: data.directories[0] ? { [data.server]: data.directories[0] } : {},
          recentlyClosed: {},
        }),
      )
    },
    {
      server: MOBILE_SERVER_URL,
      defaultServerKey: DEFAULT_SERVER_KEY,
      directories: input.projects ?? [input.directory],
    },
  )
}

export function mockMobileServer(page: Page, config: Omit<MockServerConfig, "protocol">) {
  return mockOpenCodeServer(page, { protocol: "v2", ...config })
}
