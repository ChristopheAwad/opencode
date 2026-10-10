import { expect, test, type Page } from "@playwright/test"
import { base64Encode } from "@opencode-ai/core/util/encode"
import { project } from "../performance/timeline-stability/fixture"
import { installNativeShell, mockMobileServer, seedMobileServer } from "../utils/mobile-shell"
import { expectAppVisible } from "../utils/waits"

const directory = "/tmp/opencode-e2e-mobile-sheet"
const sessionID = "ses_mobile_sheet"

async function openSession(
  page: Page,
  input: { native?: boolean; locale?: string; agents?: boolean } = {},
) {
  if (input.native ?? true) await installNativeShell(page)
  await seedMobileServer(page, { directory })
  await page.addInitScript((locale) => {
    if (locale) localStorage.setItem("opencode.global.dat:language", JSON.stringify({ locale }))
  }, input.locale)
  await mockMobileServer(page, {
    protocol: "v1",
    directory,
    project: { ...project(), id: "project", worktree: directory, directory },
    agents: input.agents === false ? [] : [
      { name: "build", mode: "primary", native: true },
      { name: "plan", mode: "primary", native: true },
    ],
    provider: {
      all: [
        {
          id: "anthropic",
          name: "Anthropic",
          models: {
            "test-model": {
              id: "test-model",
              name: "Test Model",
              limit: { context: 200_000 },
              variants: { high: {} },
            },
          },
        },
      ],
      connected: ["anthropic"],
      default: { providerID: "anthropic", modelID: "test-model" },
    },
    providerV2: {
      providers: [{ id: "anthropic", name: "Anthropic" }],
      models: [
        {
          id: "test-model",
          providerID: "anthropic",
          modelID: "test-model",
          name: "Test Model",
          family: "test",
          capabilities: { input: ["text"], output: ["text"], tools: true },
          cost: [{ input: 3, output: 15, cache: { read: 0.3, write: 3.75 } }],
          limit: { context: 200_000, output: 8_000 },
          time: { released: Date.now() },
          variants: [{ id: "high" }],
        },
      ],
      default: { providerID: "anthropic", modelID: "test-model" },
    },
    sessions: [
      {
        id: sessionID,
        slug: sessionID,
        projectID: "project",
        directory,
        title: "Sheet session",
        version: "dev",
        time: { created: 1700000000000, updated: 1700000001000 },
      },
    ],
    pageMessages: () => ({ items: [] }),
  })
  await page.goto(`/${base64Encode(directory)}/session/${sessionID}`)

  const composer = page.locator('[data-component="prompt-input-v2"]')
  await expectAppVisible(composer)
  return composer
}

test.describe("native mobile sheet", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true })

  test("closes the model sheet with Escape", async ({ page }) => {
    const composer = await openSession(page)
    const sheet = page.locator('[data-component="mobile-sheet"]')

    await composer.locator('[data-action="prompt-model"][data-control-type="panel"]').click()
    await expect(sheet).toBeVisible()

    await page.keyboard.press("Escape")
    await expect(sheet).toBeHidden()
  })

  test("closes the model sheet when the overlay is tapped", async ({ page }) => {
    const composer = await openSession(page)
    const sheet = page.locator('[data-component="mobile-sheet"]')

    await composer.locator('[data-action="prompt-model"][data-control-type="panel"]').click()
    await expect(sheet).toBeVisible()

    await page.touchscreen.tap(195, 80)
    await expect(sheet).toBeHidden()
  })

  test("keeps keyboard focus inside the open sheet", async ({ page }) => {
    const composer = await openSession(page)
    const sheet = page.locator('[data-component="mobile-sheet"]')

    await composer.locator('[data-action="prompt-model"][data-control-type="panel"]').click()
    await expect(sheet).toBeVisible()

    for (let index = 0; index < 8; index++) await page.keyboard.press("Tab")

    expect(await sheet.evaluate((element) => element.contains(document.activeElement))).toBe(true)
  })

  test("hides the agent control when no agent is available", async ({ page }) => {
    const composer = await openSession(page, { agents: false })

    await expect(composer.getByRole("button", { name: "Choose agent" })).toHaveCount(0)
  })

  test("plain web never renders the sheet", async ({ page }) => {
    const composer = await openSession(page, { native: false })

    await composer.getByRole("button", { name: "Choose agent" }).click()
    await expect(page.getByRole("menuitemradio", { name: /plan/i })).toBeVisible()
    await expect(page.locator('[data-component="mobile-sheet"]')).toHaveCount(0)

    await page.keyboard.press("Escape")
    await composer.locator('[data-action="prompt-model"][data-control-type="popover"]').click()
    await expect(page.locator('[data-component="menu-v2-content"]')).toBeVisible()
    await expect(page.locator('[data-component="mobile-sheet"]')).toHaveCount(0)
  })

  test("lays the sheet out for right-to-left locales", async ({ page }) => {
    const composer = await openSession(page, { locale: "ar" })
    const sheet = page.locator('[data-component="mobile-sheet"]')

    await expect(page.locator("html")).toHaveAttribute("dir", "rtl")
    await composer.locator('[data-action="prompt-model"][data-control-type="panel"]').click()
    await expect(sheet).toBeVisible()
    await expect(sheet).toHaveAttribute("data-side", "bottom")

    const sheetBox = await sheet.boundingBox()
    expect(sheetBox).not.toBeNull()
    expect(sheetBox!.x).toBeLessThanOrEqual(1)
    expect(sheetBox!.width).toBeGreaterThanOrEqual(388)

    const option = sheet.locator('[data-action="native-model-option"]').first()
    await expect(option).toBeVisible()
    const nameBox = await option.locator("span").first().boundingBox()
    const providerBox = await option.locator("span").nth(1).boundingBox()
    expect(nameBox).not.toBeNull()
    expect(providerBox).not.toBeNull()
    expect(nameBox!.x).toBeGreaterThan(providerBox!.x)
  })
})
