import { expect, test, type Locator, type Page } from "@playwright/test"
import { base64Encode } from "@opencode-ai/core/util/encode"
import { project } from "../performance/timeline-stability/fixture"
import { installNativeShell, mockMobileServer, seedMobileServer } from "../utils/mobile-shell"
import { expectAppVisible } from "../utils/waits"

const directory = "/tmp/opencode-e2e-mobile-haptics"
const sessionID = "ses_mobile_haptics"

async function openSession(
  page: Page,
  input: { native?: boolean; status?: Record<string, unknown>; permissions?: unknown[]; waitFor?: Locator } = {},
) {
  if (input.native ?? true) await installNativeShell(page)
  await seedMobileServer(page, { directory })
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
    permissions: input.permissions,
    sessions: [
      {
        id: sessionID,
        slug: sessionID,
        projectID: "project",
        directory,
        title: "Haptics session",
        version: "dev",
        time: { created: 1700000000000, updated: 1700000001000 },
      },
    ],
    sessionStatus: input.status,
    pageMessages: () => ({ items: [] }),
  })
  await page.goto(`/${base64Encode(directory)}/session/${sessionID}`)
  await expectAppVisible(input.waitFor ?? page.locator('[data-component="prompt-input-v2"]'))
}

function haptics(page: Page) {
  return page.evaluate(
    () =>
      (window as unknown as { __capacitorHaptics?: Array<Record<string, unknown>> }).__capacitorHaptics ?? [],
  )
}

test.describe("native haptics", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true })

  test("send fires a light impact", async ({ page }) => {
    await openSession(page)
    const submit = page.locator('[data-action="prompt-submit"]')

    await page.locator('[data-component="prompt-input"]').fill("hello from the phone")
    await expect(submit).toBeEnabled()
    await submit.click()

    await expect.poll(() => haptics(page)).toContainEqual({ method: "impact", style: "LIGHT" })
  })

  test("stop fires a medium impact", async ({ page }) => {
    await openSession(page, { status: { [sessionID]: { type: "running" } } })
    const submit = page.locator('[data-action="prompt-submit"]')

    await expect(submit).toHaveAttribute("aria-label", "Stop")
    await submit.click()
    await expect.poll(() => haptics(page)).toContainEqual({ method: "impact", style: "MEDIUM" })
  })

  test("permission allow fires a light impact", async ({ page }) => {
    await openSession(page, {
      permissions: [
        {
          id: "permission-haptics",
          sessionID,
          permission: "bash",
          patterns: ["git status"],
          metadata: {},
          always: [],
        },
      ],
      waitFor: page.locator('[data-component="dock-prompt"][data-kind="permission"]'),
    })

    const permission = page.locator('[data-component="dock-prompt"][data-kind="permission"]')
    await expect(permission).toBeVisible()

    const reply = page.waitForRequest((request) => request.method() === "POST")
    await permission.getByRole("button", { name: "Allow once" }).click()
    await reply

    await expect.poll(() => haptics(page)).toContainEqual({ method: "impact", style: "LIGHT" })
  })

  test("permission reject fires a medium impact", async ({ page }) => {
    await openSession(page, {
      permissions: [
        {
          id: "permission-haptics-reject",
          sessionID,
          permission: "bash",
          patterns: ["git diff"],
          metadata: {},
          always: [],
        },
      ],
      waitFor: page.locator('[data-component="dock-prompt"][data-kind="permission"]'),
    })

    const permission = page.locator('[data-component="dock-prompt"][data-kind="permission"]')
    await expect(permission).toBeVisible()

    const reply = page.waitForRequest((request) => request.method() === "POST")
    await permission.getByRole("button", { name: "Deny" }).click()
    await reply

    await expect.poll(() => haptics(page)).toContainEqual({ method: "impact", style: "MEDIUM" })
  })

  test("plain web never calls the haptics plugin", async ({ page }) => {
    await openSession(page, { native: false })

    expect(await page.evaluate(() => typeof window.Capacitor)).toBe("undefined")
    expect(await haptics(page)).toEqual([])
  })
})
