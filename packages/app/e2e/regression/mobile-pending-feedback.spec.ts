import { expect, test, type Page } from "@playwright/test"
import { base64Encode } from "@opencode-ai/core/util/encode"
import { project } from "../performance/timeline-stability/fixture"
import { installNativeShell, mockMobileServer, seedMobileServer } from "../utils/mobile-shell"
import { expectAppVisible } from "../utils/waits"

const directory = "/tmp/opencode-e2e-mobile-pending"
const sessionID = "ses_mobile_pending"

async function mock(page: Page, input: { projects?: string[] } = {}) {
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
    agents: [{ name: "build", mode: "primary", native: true }],
    sessions: [
      {
        id: sessionID,
        slug: sessionID,
        projectID: "project",
        directory,
        title: "Pending session",
        version: "dev",
        time: { created: 1, updated: 2 },
      },
    ],
    pageMessages: () => ({ items: [] }),
  })
  await seedMobileServer(page, { directory, projects: input.projects })
}

function gateRoute(pattern: RegExp, method: string, calls: string[]) {
  const state: { release: () => void } = { release: () => {} }
  const gate = new Promise<void>((resolve) => {
    state.release = resolve
  })
  const install = (page: Page) =>
    page.route(pattern, async (route) => {
      if (route.request().method() !== method) return route.fallback()
      calls.push(route.request().url())
      await gate
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: { "access-control-allow-origin": "*" },
        body: "{}",
      })
    })
  return { install, release: () => state.release() }
}

test.describe("mobile pending feedback", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true })

  test("follow-up send shows pending and ignores the double submit", async ({ page }) => {
    await installNativeShell(page)
    const calls: string[] = []
    const prompt = gateRoute(/\/session\/[^/?]+\/prompt_async/, "POST", calls)
    await mock(page)
    await prompt.install(page)
    await page.goto(`/${base64Encode(directory)}/session/${sessionID}`)

    const composer = page.locator('[data-component="prompt-input-v2"]')
    await expectAppVisible(composer)
    const submit = composer.locator('[data-action="prompt-submit"]')
    await expect(submit).toBeDisabled()

    await composer.locator('[data-component="prompt-input"]').fill("hello from the phone")
    await expect(submit).toBeEnabled()
    await submit.tap()

    await expect(submit).toHaveAttribute("aria-busy", "true")
    await expect(composer.locator('[data-component="prompt-submit-pending"]')).toBeVisible()
    await composer.locator('[data-component="prompt-input"]').fill("second attempt")
    await composer.locator('[data-component="prompt-input"]').press("Enter")
    await expect.poll(() => calls.length).toBe(1)

    prompt.release()
    await expect(composer.locator('[data-component="prompt-submit-pending"]')).toHaveCount(0)
    expect(calls).toHaveLength(1)
  })

  test("archive shows pending feedback and runs once", async ({ page }) => {
    await installNativeShell(page)
    const calls: string[] = []
    const archive = gateRoute(/\/session\/[^/?]+(\?|$)/, "PATCH", calls)
    await mock(page, { projects: [] })
    await archive.install(page)
    await page.goto("/")

    const row = page.locator('[data-component="home-session-row"]')
    await expectAppVisible(row)
    await row.tap()
    const header = page.locator('[data-component="mobile-session-header"]')
    await expectAppVisible(header)

    await header.getByRole("button", { name: "More options" }).tap()
    await page.getByRole("menuitem", { name: "Archive" }).tap()

    const pending = header.locator('[data-component="mobile-session-archive-pending"]')
    await expect(pending).toBeVisible()
    archive.release()
    await expect(header).toHaveCount(0)
    expect(calls).toHaveLength(1)
  })

  test("delete keeps the dialog open with pending feedback", async ({ page }) => {
    await installNativeShell(page)
    const calls: string[] = []
    const remove = gateRoute(/\/session\/[^/?]+(\?|$)/, "DELETE", calls)
    await mock(page)
    await remove.install(page)
    await page.goto(`/${base64Encode(directory)}/session/${sessionID}`)

    const header = page.locator('[data-component="mobile-session-header"]')
    await expectAppVisible(header)
    await header.getByRole("button", { name: "More options" }).tap()
    await page.getByRole("menuitem", { name: "Delete" }).tap()

    const confirm = page.getByRole("button", { name: "Delete session", exact: true })
    await expect(confirm).toBeVisible()
    await confirm.tap()

    await expect(page.locator('[data-component="button-v2"][data-variant="loading"]')).toBeVisible()
    await expect(confirm).toBeDisabled()
    await expect(confirm).toBeVisible()

    remove.release()
    await expect(confirm).toHaveCount(0)
    expect(calls).toHaveLength(1)
  })
})
