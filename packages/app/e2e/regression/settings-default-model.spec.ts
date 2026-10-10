import { expect, test, type Page } from "@playwright/test"
import { installNativeShell, seedMobileServer } from "../utils/mobile-shell"
import { mockOpenCodeServer } from "../utils/mock-server"
import { expectAppVisible } from "../utils/waits"

const directory = "/tmp/opencode-e2e-default-model"

function providers() {
  return {
    all: [
      {
        id: "server-a",
        name: "Server A",
        models: {
          "server-a": { id: "server-a", name: "Server A Model", family: "server-a", limit: { context: 200_000 } },
          "server-b": { id: "server-b", name: "Server B Model", family: "server-b", limit: { context: 200_000 } },
        },
      },
      {
        id: "openrouter",
        name: "OpenRouter",
        models: {
          "meta-llama/llama-3-70b": {
            id: "meta-llama/llama-3-70b",
            name: "Llama 3 70B",
            family: "llama",
            limit: { context: 200_000 },
          },
        },
      },
    ],
    connected: ["server-a", "openrouter"],
    default: { "server-a": "server-b" },
  }
}

async function mock(
  page: Page,
  input: {
    protocol?: "v1" | "v2"
    config?: Record<string, unknown>
    onConfigUpdate?: (body: Record<string, unknown>) => void
  } = {},
) {
  await mockOpenCodeServer(page, {
    protocol: input.protocol ?? "v1",
    providerV2: input.protocol === "v2" ? { providers: [], models: [], default: null } : undefined,
    config: input.config,
    onConfigUpdate: input.onConfigUpdate,
    provider: providers(),
    directory,
    project: {
      id: "proj_default_model",
      worktree: directory,
      vcs: "git",
      name: "DefaultModel",
      time: { created: 1_700_000_000_000, updated: 1_700_000_000_000 },
      sandboxes: [],
    },
    sessions: [],
    pageMessages: () => ({ items: [] }),
  })
}

async function seedDesktop(page: Page) {
  await page.addInitScript((directory) => {
    localStorage.setItem(
      "opencode.global.dat:server",
      JSON.stringify({
        projects: { local: [{ worktree: directory, expanded: true }] },
        lastProject: { local: directory },
      }),
    )
  }, directory)
}

async function openModelsTab(page: Page) {
  await page.keyboard.press("Control+,")
  const dialog = page.locator(".settings-v2-dialog")
  await expect(dialog).toBeVisible()
  await dialog.getByRole("tab", { name: "Models" }).click()
  return dialog
}

function control(dialog: ReturnType<Page["locator"]>) {
  return dialog.locator('[data-action="settings-default-model"]')
}

function modelList(dialog: ReturnType<Page["locator"]>) {
  return dialog.locator('[data-component="settings-default-model-list"]')
}

function configUpdate(page: Page) {
  return page.waitForRequest((request) => request.method() === "PATCH" && new URL(request.url()).pathname === "/global/config")
}

test("sets the global default model and shows it", async ({ page }) => {
  const updates: Record<string, unknown>[] = []
  await seedDesktop(page)
  await mock(page, { onConfigUpdate: (body) => updates.push(body) })
  await page.goto("/")

  const dialog = await openModelsTab(page)
  await expect(dialog.getByText("Default model", { exact: true })).toBeVisible()
  await expect(dialog.getByText("Model used for new sessions.", { exact: true })).toBeVisible()
  await expect(control(dialog)).toHaveText("Choose model")

  await control(dialog).click()
  await expect(modelList(dialog)).toBeVisible()
  const request = configUpdate(page)
  await modelList(dialog).locator('[data-slot="list-item"][data-key="server-a:server-a"]').click()
  expect((await request).postDataJSON()).toEqual({ model: "server-a/server-a" })
  await expect(control(dialog)).toHaveText("Server A Model")
  await expect(modelList(dialog)).toBeHidden()
  expect(updates).toEqual([{ model: "server-a/server-a" }])
})

test("shows the saved default and replaces it", async ({ page }) => {
  const updates: Record<string, unknown>[] = []
  await seedDesktop(page)
  await mock(page, { config: { model: "server-a/server-a" }, onConfigUpdate: (body) => updates.push(body) })
  await page.goto("/")

  const dialog = await openModelsTab(page)
  await expect(control(dialog)).toHaveText("Server A Model")

  await control(dialog).click()
  const request = configUpdate(page)
  await modelList(dialog).locator('[data-slot="list-item"][data-key="server-a:server-b"]').click()
  expect((await request).postDataJSON()).toEqual({ model: "server-a/server-b" })
  await expect(control(dialog)).toHaveText("Server B Model")
  expect(updates).toEqual([{ model: "server-a/server-b" }])
})

test("displays a slashed model id from config", async ({ page }) => {
  await seedDesktop(page)
  await mock(page, { config: { model: "openrouter/meta-llama/llama-3-70b" } })
  await page.goto("/")

  const dialog = await openModelsTab(page)
  await expect(control(dialog)).toHaveText("Llama 3 70B")
})

test("keeps slashes when saving a slashed model id", async ({ page }) => {
  await seedDesktop(page)
  await mock(page)
  await page.goto("/")

  const dialog = await openModelsTab(page)
  await control(dialog).click()
  const request = configUpdate(page)
  await modelList(dialog).locator('[data-slot="list-item"][data-key="openrouter:meta-llama/llama-3-70b"]').click()
  expect((await request).postDataJSON()).toEqual({ model: "openrouter/meta-llama/llama-3-70b" })
  await expect(control(dialog)).toHaveText("Llama 3 70B")
})

test("rolls back and reports a failed update", async ({ page }) => {
  await seedDesktop(page)
  await mock(page, { config: { model: "server-a/server-a" } })
  await page.route("**/global/config", (route) => {
    if (route.request().method() !== "PATCH") return route.fallback()
    return route.fulfill({ status: 500, headers: { "access-control-allow-origin": "*" } })
  })
  await page.goto("/")

  const dialog = await openModelsTab(page)
  await expect(control(dialog)).toHaveText("Server A Model")

  await control(dialog).click()
  await modelList(dialog).locator('[data-slot="list-item"][data-key="server-a:server-b"]').click()
  await expect(page.getByText("Request failed", { exact: true })).toBeVisible()
  await expect(control(dialog)).toHaveText("Server A Model")
})

test("hides the setting on protocol v2", async ({ page }) => {
  await seedDesktop(page)
  await mock(page, { protocol: "v2" })
  await page.goto("/")

  const dialog = await openModelsTab(page)
  await expect(control(dialog)).toHaveCount(0)
})

test("new sessions use the new default right away", async ({ page }) => {
  await seedDesktop(page)
  await mock(page)
  await page.goto("/")

  const dialog = await openModelsTab(page)
  await control(dialog).click()
  const request = configUpdate(page)
  await modelList(dialog).locator('[data-slot="list-item"][data-key="server-a:server-a"]').click()
  await request
  await dialog.press("Escape")
  await expect(dialog).toBeHidden()

  await page.locator('[data-action="home-new-session"]').click()
  await expectAppVisible(page.locator('[data-component="prompt-input-v2"]'))
  await expect(page.locator('[data-action="prompt-model"]')).toContainText("Server A Model")
})

test.describe("native shell", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true })

  test("sets the default model from the command palette", async ({ page }) => {
    await installNativeShell(page)
    await seedMobileServer(page, { directory })
    await mock(page)
    await page.goto("/")

    const nav = page.locator('[data-component="mobile-nav"]')
    await expectAppVisible(nav)
    await nav.getByRole("button", { name: "Command palette" }).click()
    const palette = page.locator(".command-palette-v2")
    await expect(palette).toBeVisible()
    await palette.getByRole("textbox").fill("settings")
    await palette.locator(".command-palette-v2-row").filter({ hasText: "Open settings" }).click()

    const dialog = page.locator(".settings-v2-dialog")
    await expect(dialog).toBeVisible()
    await dialog.getByRole("tab", { name: "Models" }).click()
    await control(dialog).tap()
    await expect(modelList(dialog)).toBeVisible()
    const request = configUpdate(page)
    await modelList(dialog).locator('[data-slot="list-item"][data-key="server-a:server-a"]').tap()
    expect((await request).postDataJSON()).toEqual({ model: "server-a/server-a" })
    await expect(control(dialog)).toHaveText("Server A Model")
  })
})
