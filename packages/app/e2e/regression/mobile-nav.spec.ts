import { expect, test, type Page } from "@playwright/test"
import { project } from "../performance/timeline-stability/fixture"
import { installNativeShell, mockMobileServer, seedMobileServer } from "../utils/mobile-shell"
import { expectAppVisible } from "../utils/waits"

const directory = "/tmp/opencode-e2e-mobile-nav"
const sessionID = "ses_mobile_nav"

function mock(page: Page, sessions: ({ id: string } & Record<string, unknown>)[] = []) {
  return mockMobileServer(page, {
    directory,
    project: { ...project(), worktree: directory, directory },
    provider: { all: [], connected: [], default: {} },
    sessions,
    pageMessages: () => ({ items: [] }),
  })
}

test.describe("native bottom navigation", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true })

  test("shows the nav and hides the desktop titlebar while keeping its mounts", async ({ page }) => {
    await installNativeShell(page)
    await seedMobileServer(page, { directory })
    await mock(page)
    await page.goto("/")

    const nav = page.locator('[data-component="mobile-nav"]')
    await expectAppVisible(nav)
    await expect(page.locator('[data-slot="titlebar-v2"]')).toBeHidden()
    await expect(page.locator("#opencode-titlebar-right")).toHaveCount(1)
    await expect(nav.getByRole("button", { name: "Home" })).toBeVisible()
    await expect(nav.getByRole("button", { name: "Command palette" })).toBeVisible()
    await expect(nav.getByRole("button", { name: "New session" })).toBeVisible()
    await expect(nav.getByRole("button", { name: "Switch server" })).toBeVisible()
  })

  test("plain web never shows the nav", async ({ page }) => {
    await seedMobileServer(page, { directory })
    await mock(page)
    await page.goto("/")

    await expect(page.locator('[data-slot="titlebar-v2"]')).toBeVisible()
    await expect(page.locator('[data-component="mobile-nav"]')).toHaveCount(0)
  })

  test("new action opens a draft composer and keeps the nav mounted", async ({ page }) => {
    await installNativeShell(page)
    await seedMobileServer(page, { directory })
    await mock(page)
    await page.goto("/")

    const nav = page.locator('[data-component="mobile-nav"]')
    await expectAppVisible(nav)
    await nav.getByRole("button", { name: "New session" }).click()

    await expect(page).toHaveURL(/\/new-session\?draftId=/)
    await expectAppVisible(page.locator('[data-component="prompt-input-v2"]'))
    await expect(nav).toBeVisible()
  })

  test("search action opens the command palette", async ({ page }) => {
    await installNativeShell(page)
    await seedMobileServer(page, { directory })
    await mock(page)
    await page.goto("/")

    const nav = page.locator('[data-component="mobile-nav"]')
    await expectAppVisible(nav)
    await nav.getByRole("button", { name: "Command palette" }).click()

    await expect(page.locator(".command-palette-v2")).toBeVisible()
  })

  test("servers action opens the server dialog", async ({ page }) => {
    await installNativeShell(page)
    await seedMobileServer(page, { directory })
    await mock(page)
    await page.goto("/")

    const nav = page.locator('[data-component="mobile-nav"]')
    await expectAppVisible(nav)
    await nav.getByRole("button", { name: "Switch server" }).click()

    await expect(page.getByRole("dialog", { name: "Servers" })).toBeVisible()
  })

  test("home action returns from a session to the list", async ({ page }) => {
    await installNativeShell(page)
    await seedMobileServer(page, { directory })
    await mock(page, [
      {
        id: sessionID,
        slug: sessionID,
        directory,
        title: "Nav session",
        time: { created: 1700000000000, updated: 1700000001000 },
      },
    ])
    await page.goto("/")

    const row = page.locator('[data-component="home-session-row"]')
    await expectAppVisible(row)
    await row.click()
    await expect(page).toHaveURL(new RegExp(`/session/${sessionID}$`))

    const nav = page.locator('[data-component="mobile-nav"]')
    await nav.getByRole("button", { name: "Home" }).click()
    await expect(page).toHaveURL(/\/$/)
    await expect(row).toBeVisible()
  })
})
