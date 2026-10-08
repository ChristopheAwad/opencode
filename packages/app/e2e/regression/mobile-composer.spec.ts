import { expect, test, type Page } from "@playwright/test"
import { base64Encode } from "@opencode-ai/core/util/encode"
import { project } from "../performance/timeline-stability/fixture"
import { installNativeShell, mockMobileServer, seedMobileServer } from "../utils/mobile-shell"
import { expectAppVisible } from "../utils/waits"

const directory = "/tmp/opencode-e2e-mobile-composer"
const sessionID = "ses_mobile_composer"

async function openSession(page: Page, input: { status?: Record<string, unknown>; native?: boolean } = {}) {
  if (input.native ?? true) await installNativeShell(page)
  await seedMobileServer(page, { directory })
  await mockMobileServer(page, {
    directory,
    project: { ...project(), id: "project", worktree: directory, directory },
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
        title: "Composer session",
        version: "dev",
        time: { created: 1700000000000, updated: 1700000001000 },
      },
    ],
    sessionStatus: input.status,
    pageMessages: () => ({ items: [] }),
  })
  await page.goto(`/${base64Encode(directory)}/session/${sessionID}`)

  const composer = page.locator('[data-component="prompt-input-v2"]')
  await expectAppVisible(composer)
  return composer
}

test.describe("native composer", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true })

  test("shows one model control and a larger send button", async ({ page }) => {
    const composer = await openSession(page)

    const model = composer.locator('[data-action="prompt-model"][data-control-type="panel"]')
    const submit = composer.locator('[data-action="prompt-submit"]')
    await expect(model).toBeVisible()
    await expect(submit).toBeVisible()
    await expect(composer.getByRole("button", { name: "Choose agent" })).toHaveCount(0)
    await expect(composer.getByRole("button", { name: "Choose model variant" })).toHaveCount(0)

    const submitBox = await submit.boundingBox()
    expect(submitBox).not.toBeNull()
    expect(submitBox!.width).toBeGreaterThanOrEqual(36)
    expect(submitBox!.height).toBeGreaterThanOrEqual(36)
  })

  test("plain web keeps the desktop composer controls", async ({ page }) => {
    const composer = await openSession(page, { native: false })

    await expect(page.locator('[data-component="mobile-nav"]')).toHaveCount(0)
    await expect(composer.getByRole("button", { name: "Choose agent" })).toBeVisible()
    await expect(composer.getByRole("button", { name: "Choose model variant" })).toBeVisible()
    const submitBox = await composer.locator('[data-action="prompt-submit"]').boundingBox()
    expect(submitBox).not.toBeNull()
    expect(submitBox!.width).toBeLessThan(36)
  })

  test("keeps the composer clear of the bottom nav", async ({ page }) => {
    const composer = await openSession(page)

    const dock = page.locator('[data-component="session-prompt-dock"]')
    const nav = page.locator('[data-component="mobile-nav"]')
    const dockBox = await dock.boundingBox()
    const navBox = await nav.boundingBox()
    expect(dockBox).not.toBeNull()
    expect(navBox).not.toBeNull()
    expect(dockBox!.y + dockBox!.height).toBeLessThanOrEqual(navBox!.y + 1)
    await expect(composer).toBeVisible()
  })

  test("opens the model panel with model and reasoning options", async ({ page }) => {
    const composer = await openSession(page)

    const model = composer.locator('[data-action="prompt-model"][data-control-type="panel"]')
    await expect(model).toBeVisible()
    await model.click()

    const panel = page.locator('[data-component="native-model-panel"]')
    await expect(panel).toBeVisible()
    await expect(panel.getByRole("button", { name: /Test Model/ })).toBeVisible()

    const high = panel.locator('[data-action="native-variant-option"][data-variant="high"]')
    await expect(high).toBeVisible()
    await high.click()
    await expect(high).toHaveAttribute("aria-pressed", "true")

    await page.keyboard.press("Escape")
    await expect(panel).toBeHidden()
  })

  test("sends typed text and turns into stop while working", async ({ page }) => {
    const composer = await openSession(page)
    const submit = composer.locator('[data-action="prompt-submit"]')

    await expect(submit).toBeDisabled()
    await composer.locator('[data-component="prompt-input"]').fill("hello from the phone")
    await expect(submit).toBeEnabled()
    await expect(submit).toHaveAttribute("aria-label", "Send")
  })

  test("shows stop while a blank session is working", async ({ page }) => {
    const composer = await openSession(page, { status: { [sessionID]: { type: "running" } } })
    const submit = composer.locator('[data-action="prompt-submit"]')

    await expect(submit).toBeEnabled()
    await expect(submit).toHaveAttribute("aria-label", "Stop")
  })

  test("opens the native attachment picker", async ({ page }) => {
    const composer = await openSession(page)

    const chooser = page.waitForEvent("filechooser")
    await composer.locator('[data-action="prompt-attach"]').click()
    await page.getByRole("menuitem", { name: "Images and files" }).click()

    await chooser
  })
})
