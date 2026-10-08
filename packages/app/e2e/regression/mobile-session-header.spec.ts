import { expect, test, type Page } from "@playwright/test"
import { base64Encode } from "@opencode-ai/core/util/encode"
import { project } from "../performance/timeline-stability/fixture"
import { installNativeShell, mockMobileServer, seedMobileServer } from "../utils/mobile-shell"
import { expectAppVisible } from "../utils/waits"

const directory = "/tmp/opencode-e2e-mobile-header"
const sessionID = "ses_mobile_header"
const longTitle = "A very long session title that cannot fit on one phone line and must be truncated by the header"

async function openSession(
  page: Page,
  input: { title?: string; status?: Record<string, unknown>; locale?: string; native?: boolean } = {},
) {
  if (input.native ?? true) await installNativeShell(page)
  await seedMobileServer(page, { directory })
  await page.addInitScript((locale) => {
    if (locale) localStorage.setItem("opencode.global.dat:language", JSON.stringify({ locale }))
  }, input.locale)
  await mockMobileServer(page, {
    directory,
    project: { ...project(), id: "project", worktree: directory, directory },
    provider: {
      all: [
        {
          id: "opencode",
          name: "OpenCode",
          models: { "test-model": { id: "test-model", name: "Test Model", limit: { context: 200_000 } } },
        },
      ],
      connected: ["opencode"],
      default: { providerID: "opencode", modelID: "test-model" },
    },
    sessions: [
      {
        id: sessionID,
        slug: sessionID,
        projectID: "project",
        directory,
        title: input.title ?? "Header session",
        version: "dev",
        time: { created: 1700000000000, updated: 1700000001000 },
      },
    ],
    sessionStatus: input.status,
    pageMessages: () => ({ items: [] }),
  })
  await page.goto(`/${base64Encode(directory)}/session/${sessionID}`)
  await expectAppVisible(page.locator('[data-component="prompt-input-v2"]'))

  const header = page.locator('[data-component="mobile-session-header"]')
  if (input.native ?? true) await expectAppVisible(header)
  return header
}

test.describe("compact native session header", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true })

  test("shows title and tabs once while the desktop chrome stays hidden", async ({ page }) => {
    const header = await openSession(page)

    await expect(header.getByText("Header session")).toBeVisible()
    await expect(header.locator('[data-action="mobile-session-tab-session"]')).toBeVisible()
    await expect(header.locator('[data-action="mobile-session-tab-changes"]')).toBeVisible()
    await expect(header.getByRole("button", { name: "More options" })).toBeVisible()
    await expect(page.locator('[data-slot="titlebar-v2"]')).toBeHidden()
    await expect(page.locator('[role="tab"]')).toHaveCount(0)
  })

  test("back returns to the sessions list", async ({ page }) => {
    const header = await openSession(page)

    await header.getByRole("button", { name: "Navigate back" }).click()

    await expect(page).toHaveURL(/\/$/)
    await expect(page.locator('[data-component="home-session-row"]')).toBeVisible()
    await expect(page.locator('[data-component="mobile-nav"]')).toBeVisible()
  })

  test("overflow menu reuses session actions", async ({ page }) => {
    const header = await openSession(page)

    await header.getByRole("button", { name: "More options" }).click()

    await expect(page.getByRole("menuitem", { name: "Share" })).toBeVisible()
    await expect(page.getByRole("menuitem", { name: "Export" })).toBeVisible()
    await expect(page.getByRole("menuitem", { name: "Archive" })).toBeVisible()
    await page.getByRole("menuitem", { name: "New session" }).click()

    await expect(page).toHaveURL(/\/new-session\?draftId=/)
  })

  test("shows the running spinner while the session works", async ({ page }) => {
    const header = await openSession(page, { status: { [sessionID]: { type: "running" } } })

    await expect(header.locator('[data-component="session-progress-indicator-v2"]')).toBeVisible()
  })

  test("falls back to the new-session label when the title is blank", async ({ page }) => {
    const header = await openSession(page, { title: "   " })

    await expect(header.locator('[data-slot="mobile-session-title"]')).toHaveText("New session")
  })

  test("plain web keeps the desktop chrome", async ({ page }) => {
    await openSession(page, { native: false })

    await expect(page.locator('[data-component="mobile-session-header"]')).toHaveCount(0)
    await expect(page.locator('[data-slot="titlebar-v2"]')).toBeVisible()
    await expect(page.locator('[role="tab"]')).toHaveCount(2)
  })

  test("truncates very long titles", async ({ page }) => {
    const header = await openSession(page, { title: longTitle })

    const title = header.locator('[data-slot="mobile-session-title"]')
    await expect(title).toHaveText(longTitle)
    expect(await title.evaluate((element) => getComputedStyle(element).textOverflow)).toBe("ellipsis")
  })

  test("lays out for right-to-left locales", async ({ page }) => {
    const header = await openSession(page, { locale: "ar" })

    await expect(page.locator("html")).toHaveAttribute("dir", "rtl")
    const back = header.locator('[data-action="mobile-session-back"]')
    const tab = header.locator('[data-action="mobile-session-tab-session"]')
    const backBox = await back.boundingBox()
    const tabBox = await tab.boundingBox()
    expect(backBox).not.toBeNull()
    expect(tabBox).not.toBeNull()
    expect(backBox!.x).toBeGreaterThan(tabBox!.x + tabBox!.width - 1)
  })
})
