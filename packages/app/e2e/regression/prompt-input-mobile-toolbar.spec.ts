import { expect, test, type Page } from "@playwright/test"
import { base64Encode } from "@opencode-ai/core/util/encode"
import { mockOpenCodeServer } from "../utils/mock-server"
import { expectAppVisible } from "../utils/waits"

const directory = "C:/OpenCode/PromptInputMobileToolbarRegression"
const projectID = "proj_prompt_input_mobile_toolbar_regression"
const sessionID = "ses_prompt_input_mobile_toolbar_regression"

async function openNarrowComposer(page: Page, modelName: string) {
  await page.setViewportSize({ width: 360, height: 800 })
  await mockOpenCodeServer(page, {
    directory,
    project: {
      id: projectID,
      worktree: directory,
      vcs: "git",
      name: "prompt-input-mobile-toolbar-regression",
      time: { created: 1700000000000, updated: 1700000000000 },
      sandboxes: [],
    },
    provider: {
      all: [
        {
          id: "opencode",
          name: "OpenCode",
          models: {
            "test-model": {
              id: "test-model",
              name: modelName,
              limit: { context: 200_000 },
              variants: { high: {} },
            },
          },
        },
      ],
      connected: ["opencode"],
      default: { providerID: "opencode", modelID: "test-model" },
    },
    sessions: [
      {
        id: sessionID,
        slug: "prompt-input-mobile-toolbar-regression",
        projectID,
        directory,
        title: "Prompt input mobile toolbar regression",
        version: "dev",
        time: { created: 1700000000000, updated: 1700000000000 },
      },
    ],
    pageMessages: () => ({ items: [] }),
  })
  await page.addInitScript(() => {
    localStorage.setItem("settings.v3", JSON.stringify({ general: { newLayoutDesigns: true } }))
  })

  await page.goto(`/${base64Encode(directory)}/session/${sessionID}`)

  const composer = page.locator('[data-component="prompt-input-v2"]')
  await expectAppVisible(composer)
  return composer
}

async function labelWidthRatios(page: Page) {
  return page.evaluate(() => {
    const measure = (button: HTMLElement) => {
      const label = button.querySelector("span.truncate") as HTMLElement
      const style = getComputedStyle(label)
      const probe = document.createElement("span")
      probe.style.cssText = `position:absolute;visibility:hidden;white-space:nowrap;font:${style.font};text-transform:${style.textTransform};letter-spacing:${style.letterSpacing}`
      probe.textContent = label.textContent ?? ""
      document.body.appendChild(probe)
      const natural = probe.getBoundingClientRect().width
      probe.remove()
      return label.getBoundingClientRect().width / natural
    }
    const root = document.querySelector('[data-component="prompt-input-v2"]') as HTMLElement
    return {
      agent: measure(root.querySelector('button[aria-label="Choose agent"]') as HTMLElement),
      model: measure(root.querySelector('[data-action="prompt-model"]') as HTMLElement),
      variant: measure(root.querySelector('button[aria-label="Choose model variant"]') as HTMLElement),
    }
  })
}

test("keeps send and reasoning effort visible in a narrow composer", async ({ page }) => {
  const composer = await openNarrowComposer(page, "Claude 3.7 Sonnet Extended Thinking Preview 20250219")

  const submit = composer.locator('[data-action="prompt-submit"]')
  const model = composer.locator('[data-action="prompt-model"]')
  const variant = composer.getByRole("button", { name: "Choose model variant" })
  await expect(submit).toBeVisible()
  await expect(model).toBeVisible()
  await expect(variant).toBeVisible()

  const composerBox = await composer.boundingBox()
  const submitBox = await submit.boundingBox()
  const modelBox = await model.boundingBox()
  const variantBox = await variant.boundingBox()
  expect(composerBox).not.toBeNull()
  expect(submitBox).not.toBeNull()
  expect(modelBox).not.toBeNull()
  expect(variantBox).not.toBeNull()

  const right = (box: NonNullable<typeof composerBox>) => box.x + box.width
  const left = (box: NonNullable<typeof composerBox>) => box.x

  expect(left(modelBox!)).toBeGreaterThanOrEqual(left(composerBox!) - 1)
  expect(left(variantBox!)).toBeGreaterThanOrEqual(left(composerBox!) - 1)
  expect(left(submitBox!)).toBeGreaterThanOrEqual(left(composerBox!) - 1)
  expect(right(modelBox!)).toBeLessThanOrEqual(left(submitBox!) + 1)
  expect(right(variantBox!)).toBeLessThanOrEqual(left(submitBox!) + 1)
  expect(right(submitBox!)).toBeLessThanOrEqual(right(composerBox!) + 1)
  expect(right(variantBox!)).toBeLessThanOrEqual(right(composerBox!) + 1)
})

test("shows more agent, model, and reasoning effort label text in a narrow composer", async ({ page }) => {
  const composer = await openNarrowComposer(page, "DeepSeek V4.1 Flash")

  const model = composer.locator('[data-action="prompt-model"]')
  const variant = composer.getByRole("button", { name: "Choose model variant" })
  await expect(model).toBeVisible()
  await expect(variant).toBeVisible()

  const ratios = await labelWidthRatios(page)
  expect(ratios.agent).toBeGreaterThan(0.55)
  expect(ratios.model).toBeGreaterThan(0.68)
  expect(ratios.variant).toBeGreaterThan(0.6)
})
