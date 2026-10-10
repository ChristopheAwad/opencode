import { expect, test, type Locator, type Page } from "@playwright/test"
import { base64Encode } from "@opencode-ai/core/util/encode"
import { project } from "../performance/timeline-stability/fixture"
import { installNativeShell, mockMobileServer, seedMobileServer } from "../utils/mobile-shell"
import { expectAppVisible } from "../utils/waits"

const directory = "/tmp/opencode-e2e-mobile-menu"
const otherDirectory = "/tmp/opencode-e2e-mobile-menu-other"
const sessionID = "ses_mobile_menu"
const otherSessionID = "ses_mobile_menu_other"

function sessionRow(page: Page, title: string) {
  return page.locator('[data-component="home-session-row"]', { hasText: title })
}

async function openHome(page: Page, input: { native?: boolean; shareDisabled?: boolean } = {}) {
  if (input.native ?? true) await installNativeShell(page)
  await seedMobileServer(page, { directory, projects: [directory, otherDirectory], selected: null })
  await mockMobileServer(page, {
    protocol: "v1",
    directory,
    config: input.shareDisabled ? { share: "disabled" } : undefined,
    project: { ...project(), id: "project", worktree: directory, directory },
    provider: {
      all: [{ id: "anthropic", name: "Anthropic", models: { "test-model": { id: "test-model", name: "Test Model", limit: { context: 200_000 } } } }],
      connected: ["anthropic"],
      default: { providerID: "anthropic", modelID: "test-model" },
    },
    sessions: [
      {
        id: sessionID,
        slug: sessionID,
        projectID: "project",
        directory,
        title: "Menu session",
        version: "dev",
        time: { created: 1700000001000, updated: 1700000001000 },
      },
      {
        id: otherSessionID,
        slug: otherSessionID,
        projectID: "project",
        directory: otherDirectory,
        title: "Other project session",
        version: "dev",
        time: { created: 1700000000000, updated: 1700000000000 },
      },
    ],
    pageMessages: () => ({ items: [] }),
  })
  await page.goto("/")
  await expectAppVisible(sessionRow(page, "Menu session"))
}

async function longPress(page: Page, target: Locator) {
  await page.clock.install()
  const box = await target.boundingBox()
  expect(box).not.toBeNull()
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2)
  await page.mouse.down()
  await page.clock.fastForward(600)
  await page.mouse.up()
  await page.clock.fastForward(701)
  await page.clock.resume()
}

test.describe("native session row menu", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, permissions: ["clipboard-read", "clipboard-write"] })

  test("long-press opens the same actions as the header menu", async ({ page }) => {
    await openHome(page)
    await longPress(page, sessionRow(page, "Menu session"))

    const sheet = page.locator('[data-component="mobile-sheet"]')
    await expect(sheet).toBeVisible()
    await expect(sheet.locator('[data-action^="session-action-"]')).toHaveText([
      "Rename",
      "Share",
      "Export",
      "Archive",
      "Delete",
      "New session",
    ])
  })

  test("a drag cancels the long-press", async ({ page }) => {
    await openHome(page)
    await page.clock.install()
    const row = sessionRow(page, "Menu session")
    const box = await row.boundingBox()
    expect(box).not.toBeNull()
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2)
    await page.mouse.down()
    await page.mouse.move(box!.x + box!.width / 2 + 60, box!.y + box!.height / 2, { steps: 5 })
    await page.clock.fastForward(600)
    await page.mouse.up()

    await expect(page.locator('[data-component="mobile-sheet"]')).toHaveCount(0)
  })

  test("hides Share when sharing is disabled", async ({ page }) => {
    await openHome(page, { shareDisabled: true })
    await longPress(page, sessionRow(page, "Menu session"))

    const sheet = page.locator('[data-component="mobile-sheet"]')
    await expect(sheet).toBeVisible()
    await expect(sheet.locator('[data-action="session-action-share"]')).toHaveCount(0)
    await expect(sheet.locator('[data-action="session-action-export"]')).toBeVisible()
  })

  test("short tap opens the session instead of the menu", async ({ page }) => {
    await openHome(page)
    await sessionRow(page, "Menu session").tap()

    await expect(page).toHaveURL(new RegExp(`/session/${sessionID}`))
    await expect(page.locator('[data-component="mobile-sheet"]')).toHaveCount(0)
  })

  test("renames the session from the sheet", async ({ page }) => {
    await openHome(page)
    await page.route(/\/session\/[^/?]+(?:\?.*)?$/, async (route) => {
      if (route.request().method() !== "PATCH") return route.fallback()
      const payload = route.request().postDataJSON<{ title?: string }>()
      await route.fulfill({ json: { id: sessionID, title: payload.title ?? "" } })
    })

    await longPress(page, sessionRow(page, "Menu session"))
    await page.locator('[data-action="session-action-rename"]').click()

    const input = page.getByRole("textbox", { name: "Rename" })
    await expect(input).toHaveValue("Menu session")
    await input.fill("Renamed from phone")
    const request = page.waitForRequest(
      (req) => req.method() === "PATCH" && /\/session\/[^/?]+(?:\?.*)?$/.test(req.url()),
    )
    await page.getByRole("button", { name: "Save" }).click()
    await request

    await expect(sessionRow(page, "Renamed from phone")).toBeVisible()
  })

  test("archives the row with exactly one request", async ({ page }) => {
    await openHome(page)
    const requests: string[] = []
    await page.route(/\/session\/[^/?]+(?:\?.*)?$/, async (route) => {
      if (route.request().method() !== "PATCH") return route.fallback()
      requests.push(route.request().url())
      await route.fulfill({ json: {} })
    })

    await longPress(page, sessionRow(page, "Menu session"))
    await page.locator('[data-action="session-action-archive"]').click()

    await expect(sessionRow(page, "Menu session")).toHaveCount(0)
    expect(requests).toHaveLength(1)
    expect(new URL(requests[0]!).searchParams.get("directory")).toBe(directory)
  })

  test("archives a cross-project row against its own directory", async ({ page }) => {
    await openHome(page)
    const requests: string[] = []
    await page.route(/\/session\/[^/?]+(?:\?.*)?$/, async (route) => {
      if (route.request().method() !== "PATCH") return route.fallback()
      requests.push(route.request().url())
      await route.fulfill({ json: {} })
    })

    await longPress(page, sessionRow(page, "Other project session"))
    await page.locator('[data-action="session-action-archive"]').click()

    await expect(sessionRow(page, "Other project session")).toHaveCount(0)
    expect(requests).toHaveLength(1)
    expect(new URL(requests[0]!).searchParams.get("directory")).toBe(otherDirectory)
  })

  test("deletes the session from the sheet", async ({ page }) => {
    await openHome(page)

    await longPress(page, sessionRow(page, "Menu session"))
    await page.locator('[data-action="session-action-delete"]').click()
    const confirm = page.getByRole("button", { name: "Delete session" })
    await expect(confirm).toBeVisible()

    const request = page.waitForRequest((req) => req.method() === "DELETE" && req.url().includes(sessionID))
    await confirm.click()
    await request

    await expect(sessionRow(page, "Menu session")).toHaveCount(0)
  })

  test("keeps the delete dialog open when the request fails", async ({ page }) => {
    await openHome(page)
    await page.route(/\/session\/[^/?]+(?:\?.*)?$/, async (route) => {
      if (route.request().method() !== "DELETE") return route.fallback()
      await route.fulfill({ status: 500, json: { error: "boom" } })
    })

    await longPress(page, sessionRow(page, "Menu session"))
    await page.locator('[data-action="session-action-delete"]').click()

    const confirm = page.getByRole("button", { name: "Delete session" })
    const request = page.waitForRequest((req) => req.method() === "DELETE" && req.url().includes(sessionID))
    await confirm.click()
    await request

    await expect(confirm).toBeVisible()
    await expect(sessionRow(page, "Menu session")).toBeVisible()
  })

  test("shares the session and copies the link", async ({ page }) => {
    await openHome(page)
    await page.route(/\/session\/[^/]+\/share(?:\?.*)?$/, async (route) => {
      if (route.request().method() !== "POST") return route.fallback()
      await route.fulfill({ json: { share: { url: "https://example.com/s/abc" } } })
    })

    await longPress(page, sessionRow(page, "Menu session"))
    const request = page.waitForRequest((req) => req.method() === "POST" && req.url().includes("/share"))
    await page.locator('[data-action="session-action-share"]').click()
    await request

    await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe("https://example.com/s/abc")
  })

  test("exports the session as a download", async ({ page }) => {
    await openHome(page)

    await longPress(page, sessionRow(page, "Menu session"))
    const download = page.waitForEvent("download")
    await page.locator('[data-action="session-action-export"]').click()
    const file = await download

    expect(file.suggestedFilename()).toBe("menu-session.json")
  })

  test("starts a new session from the sheet", async ({ page }) => {
    await openHome(page)

    await longPress(page, sessionRow(page, "Menu session"))
    await page.locator('[data-action="session-action-new"]').click()

    await expect(page).toHaveURL(/\/new-session\?draftId=/)
  })

  test("native rows are at least 44px tall", async ({ page }) => {
    await openHome(page)
    await expect(page.locator("html")).toHaveAttribute("data-native", "")

    const box = await sessionRow(page, "Menu session").boundingBox()
    expect(box).not.toBeNull()
    expect(box!.height).toBeGreaterThanOrEqual(44)
  })

  test("plain web keeps 40px rows and no native marker", async ({ page }) => {
    await openHome(page, { native: false })
    await expect(page.locator("html")).not.toHaveAttribute("data-native", "")

    const box = await sessionRow(page, "Menu session").boundingBox()
    expect(box).not.toBeNull()
    expect(box!.height).toBeLessThan(44)
  })
})
