import { expect, test, type Locator, type Page } from "@playwright/test"
import { base64Encode } from "@opencode-ai/core/util/encode"
import { project } from "../performance/timeline-stability/fixture"
import { installNativeShell, mockMobileServer, seedMobileServer } from "../utils/mobile-shell"
import { expectAppVisible } from "../utils/waits"

const directory = "/tmp/opencode-e2e-mobile-swipe"
const sessionID = "ses_mobile_swipe"

function sessionRow(page: Page, title: string) {
  return page.locator('[data-component="home-session-row"]', { hasText: title })
}

async function openHome(page: Page, input: { native?: boolean; locale?: string } = {}) {
  if (input.native ?? true) await installNativeShell(page)
  await seedMobileServer(page, { directory, selected: null })
  await page.addInitScript((locale) => {
    if (locale) localStorage.setItem("opencode.global.dat:language", JSON.stringify({ locale }))
  }, input.locale)
  await mockMobileServer(page, {
    protocol: "v1",
    directory,
    project: { ...project(), id: "project", worktree: directory, directory },
    provider: {
      all: [
        {
          id: "anthropic",
          name: "Anthropic",
          models: { "test-model": { id: "test-model", name: "Test Model", limit: { context: 200_000 } } },
        },
      ],
      connected: ["anthropic"],
      default: { providerID: "anthropic", modelID: "test-model" },
    },
    sessions: [
      {
        id: sessionID,
        slug: sessionID,
        projectID: "project",
        directory,
        title: "Swipe target",
        version: "dev",
        time: { created: 1700000001000, updated: 1700000001000 },
      },
      {
        id: "ses_mobile_swipe_other",
        slug: "ses_mobile_swipe_other",
        projectID: "project",
        directory,
        title: "Other row",
        version: "dev",
        time: { created: 1700000000000, updated: 1700000000000 },
      },
    ],
    pageMessages: () => ({ items: [] }),
  })
  await page.goto("/")
  await expectAppVisible(sessionRow(page, "Swipe target"))
}

async function swipe(page: Page, target: Locator, deltaX: number, deltaY = 0) {
  const box = await target.boundingBox()
  expect(box).not.toBeNull()
  const y = box!.y + box!.height / 2
  await page.mouse.move(box!.x + box!.width / 2, y)
  await page.mouse.down()
  await page.mouse.move(box!.x + box!.width / 2 + deltaX, y + deltaY, { steps: 10 })
  await page.mouse.up()
}

function affordance(page: Page, title: string) {
  return sessionRow(page, title).locator("xpath=..").locator('[data-component="home-session-archive-affordance"]')
}

function haptics(page: Page) {
  return page.evaluate(
    () =>
      (window as unknown as { __capacitorHaptics?: Array<Record<string, unknown>> }).__capacitorHaptics ?? [],
  )
}

test.describe("native session swipe", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true })

  test("swipe toward the inline end reveals archive and the button archives once", async ({ page }) => {
    await openHome(page)
    const requests: string[] = []
    await page.route(/\/session\/[^/?]+(?:\?.*)?$/, async (route) => {
      if (route.request().method() !== "PATCH") return route.fallback()
      requests.push(route.request().url())
      await route.fulfill({ json: {} })
    })

    const row = sessionRow(page, "Swipe target")
    await swipe(page, row, -80)
    await expect(affordance(page, "Swipe target")).toHaveAttribute("aria-hidden", "false")
    const revealed = await row.boundingBox()
    expect(revealed).not.toBeNull()
    expect(revealed!.x).toBeLessThan(0)

    await affordance(page, "Swipe target").locator('[data-action="home-session-archive"]').click()
    await expect(sessionRow(page, "Swipe target")).toHaveCount(0)
    expect(requests).toHaveLength(1)
    expect(await haptics(page)).toContainEqual({ method: "notification", type: "SUCCESS" })
  })

  test("a full swipe archives once and commits with a haptic", async ({ page }) => {
    await openHome(page)
    const requests: string[] = []
    await page.route(/\/session\/[^/?]+(?:\?.*)?$/, async (route) => {
      if (route.request().method() !== "PATCH") return route.fallback()
      requests.push(route.request().url())
      await route.fulfill({ json: {} })
    })

    await swipe(page, sessionRow(page, "Swipe target"), -260)
    await expect(sessionRow(page, "Swipe target")).toHaveCount(0)
    expect(requests).toHaveLength(1)
    expect(await haptics(page)).toContainEqual({ method: "impact", style: "MEDIUM" })
  })

  test("vertical scrolling does not reveal the archive action", async ({ page }) => {
    await openHome(page)
    const row = sessionRow(page, "Swipe target")

    await swipe(page, row, 0, 80)
    await expect(affordance(page, "Swipe target")).toHaveAttribute("aria-hidden", "true")
    const box = await row.boundingBox()
    expect(box).not.toBeNull()
    expect(box!.x).toBeGreaterThanOrEqual(0)
  })

  test("tapping outside closes an open reveal", async ({ page }) => {
    await openHome(page)
    await swipe(page, sessionRow(page, "Swipe target"), -80)
    await expect(affordance(page, "Swipe target")).toHaveAttribute("aria-hidden", "false")

    await page.getByPlaceholder("Search sessions").tap()

    await expect(affordance(page, "Swipe target")).toHaveAttribute("aria-hidden", "true")
    const box = await sessionRow(page, "Swipe target").boundingBox()
    expect(box).not.toBeNull()
    expect(box!.x).toBeGreaterThanOrEqual(0)
    await expect(page).toHaveURL("/")
  })

  test("mirrors the reveal side for right-to-left locales", async ({ page }) => {
    await openHome(page, { locale: "ar" })
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl")

    const row = sessionRow(page, "Swipe target")
    await swipe(page, row, 80)
    await expect(affordance(page, "Swipe target")).toHaveAttribute("aria-hidden", "false")
    const revealed = await row.boundingBox()
    expect(revealed).not.toBeNull()
    expect(revealed!.x).toBeGreaterThan(0)
    const box = await affordance(page, "Swipe target").boundingBox()
    expect(box).not.toBeNull()
    expect(box!.x).toBeLessThan(40)
  })

  test("plain web has no swipe affordance", async ({ page }) => {
    await openHome(page, { native: false })
    await expect(page.locator('[data-component="home-session-archive-affordance"]')).toHaveCount(0)
    await swipe(page, sessionRow(page, "Swipe target"), -80)
    await expect(page.locator('[data-component="mobile-sheet"]')).toHaveCount(0)
  })
})
