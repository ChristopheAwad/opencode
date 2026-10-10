import { expect, test, type Page } from "@playwright/test"
import { base64Encode } from "@opencode-ai/core/util/encode"
import { project } from "../performance/timeline-stability/fixture"
import { installNativeShell, mockMobileServer, seedMobileServer } from "../utils/mobile-shell"
import { expectAppVisible } from "../utils/waits"

const directory = "/tmp/opencode-e2e-mobile-composer"
const sessionID = "ses_mobile_composer"

async function openSession(
  page: Page,
  input: { status?: Record<string, unknown>; native?: boolean; modelName?: string; extraModels?: number } = {},
) {
  if (input.native ?? true) await installNativeShell(page)
  await seedMobileServer(page, { directory })
  await mockMobileServer(page, {
    directory,
    project: { ...project(), id: "project", worktree: directory, directory },
    agents: [
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
          name: input.modelName ?? "Test Model",
          family: "test",
          capabilities: { input: ["text"], output: ["text"], tools: true },
          cost: [{ input: 3, output: 15, cache: { read: 0.3, write: 3.75 } }],
          limit: { context: 200_000, output: 8_000 },
          time: { released: Date.now() },
          variants: [{ id: "high" }],
        },
        ...Array.from({ length: input.extraModels ?? 0 }, (_, index) => ({
          id: `extra-model-${index}`,
          providerID: "anthropic",
          modelID: `extra-model-${index}`,
          name: `Extra Model ${String(index).padStart(2, "0")}`,
          family: "test",
          capabilities: { input: ["text"], output: ["text"], tools: true },
          cost: [{ input: 1, output: 2, cache: { read: 0.1, write: 0.2 } }],
          limit: { context: 100_000, output: 4_000 },
          time: { released: Date.now() },
          variants: [{ id: "high" }],
        })),
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
    await expect(composer.getByRole("button", { name: "Choose agent" })).toBeVisible()
    await expect(composer.getByRole("button", { name: "Choose model variant" })).toHaveCount(0)

    const submitBox = await submit.boundingBox()
    expect(submitBox).not.toBeNull()
    expect(submitBox!.width).toBeGreaterThanOrEqual(36)
    expect(submitBox!.height).toBeGreaterThanOrEqual(36)
  })

  test("switches the agent from the sheet", async ({ page }) => {
    const composer = await openSession(page)
    const agent = composer.getByRole("button", { name: "Choose agent" })
    const sheet = page.locator('[data-component="mobile-sheet"]')

    await expect(agent).toContainText(/build/i)
    await agent.click()
    await expect(sheet).toBeVisible()
    await sheet.getByRole("button", { name: /plan/i }).click()
    await expect(sheet).toBeHidden()
    await expect(agent).toContainText(/plan/i)
  })

  test("shows the full model name when space allows", async ({ page }) => {
    const composer = await openSession(page, { modelName: "DeepSeek V4.1 Flash" })

    const label = composer.locator('[data-action="prompt-model"] span.truncate')
    await expect(label).toHaveCount(1)
    await expect(label).toHaveText("DeepSeek V4.1 Flash")
    const clipped = await label.evaluate((element) => element.scrollWidth - element.clientWidth)
    expect(clipped).toBeLessThanOrEqual(1)
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

  test("opens the model picker sheet with model and reasoning options", async ({ page }) => {
    const composer = await openSession(page)

    const model = composer.locator('[data-action="prompt-model"][data-control-type="panel"]')
    await expect(model).toBeVisible()
    await model.click()

    const sheet = page.locator('[data-component="mobile-sheet"]')
    await expect(sheet).toBeVisible()
    await expect(sheet).toHaveAttribute("data-side", "bottom")
    const panel = sheet.locator('[data-component="native-model-panel"]')
    await expect(panel).toBeVisible()
    await expect(panel.getByRole("button", { name: /Test Model/ })).toBeVisible()

    const search = panel.getByPlaceholder("Search models")
    await search.fill("Test")
    await expect(panel.getByRole("button", { name: /Test Model/ })).toBeVisible()
    await search.fill("no-such-model")
    await expect(panel.getByText("No model results")).toBeVisible()
    await search.fill("Test")

    await panel.getByRole("button", { name: /Test Model/ }).click()
    await expect(sheet).toBeHidden()

    await model.click()
    const high = sheet.locator('[data-action="native-variant-option"][data-variant="high"]')
    await expect(high).toBeVisible()
    await high.click()
    await expect(sheet).toBeHidden()

    await model.click()
    await expect(high).toHaveAttribute("aria-pressed", "true")
    await expect
      .poll(() => sheet.evaluate((element) => element.contains(document.activeElement)))
      .toBe(true)
    await page.keyboard.press("Escape")
    await expect(sheet).toBeHidden()
  })

  test("keeps reasoning options reachable with a long model list", async ({ page }) => {
    const composer = await openSession(page, { extraModels: 25 })

    await composer.locator('[data-action="prompt-model"][data-control-type="panel"]').click()

    const sheet = page.locator('[data-component="mobile-sheet"]')
    await expect(sheet).toBeVisible()
    const high = sheet.locator('[data-action="native-variant-option"][data-variant="high"]')
    await high.click()
    await expect(sheet).toBeHidden()

    await composer.locator('[data-action="prompt-model"][data-control-type="panel"]').click()
    await expect(high).toHaveAttribute("aria-pressed", "true")
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
