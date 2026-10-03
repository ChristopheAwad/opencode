import { expect, test } from "@playwright/test"
import { base64Encode } from "@opencode-ai/core/util/encode"
import { mockOpenCodeServer } from "../utils/mock-server"
import { expectAppVisible } from "../utils/waits"

const directory = "C:/OpenCode/PromptInputMobileToolbarRegression"
const projectID = "proj_prompt_input_mobile_toolbar_regression"
const sessionID = "ses_prompt_input_mobile_toolbar_regression"

test("keeps send and reasoning effort visible in a narrow composer", async ({ page }) => {
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
            "long-name-model": {
              id: "long-name-model",
              name: "Claude 3.7 Sonnet Extended Thinking Preview 20250219",
              limit: { context: 200_000 },
              variants: { high: {} },
            },
          },
        },
      ],
      connected: ["opencode"],
      default: { providerID: "opencode", modelID: "long-name-model" },
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
  const submit = composer.locator('[data-action="prompt-submit"]')
  const model = composer.locator('[data-action="prompt-model"]')
  const variant = composer.getByRole("button", { name: "Choose model variant" })
  await expectAppVisible(composer)
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
