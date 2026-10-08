import { expect, test, type Page } from "@playwright/test"
import { project } from "../performance/timeline-stability/fixture"
import { installNativeShell, mockMobileServer, seedMobileServer } from "../utils/mobile-shell"
import { expectAppVisible } from "../utils/waits"

const directory = "/tmp/opencode-e2e-mobile-sessions"
const remoteDirectory = "/tmp/opencode-e2e-mobile-remote"
const sessionID = "ses_mobile_remote"
const longTitle = "A very long session title that cannot fit on one phone line and must be truncated by the row"

function mock(page: Page, sessions: ({ id: string } & Record<string, unknown>)[]) {
  return mockMobileServer(page, {
    directory,
    project: { ...project(), id: "project", worktree: directory, directory },
    provider: { all: [], connected: [], default: {} },
    sessions,
    pageMessages: () => ({ items: [] }),
  })
}

const remoteSession = {
  id: sessionID,
  slug: sessionID,
  projectID: "project",
  directory: remoteDirectory,
  title: "Remote server session",
  time: { created: 1700000000000, updated: 1700000001000 },
}

test.describe("native sessions first", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true })

  test("lists server sessions without local projects and opens one", async ({ page }) => {
    await installNativeShell(page)
    await seedMobileServer(page, { directory, projects: [] })
    await mock(page, [remoteSession])
    await page.goto("/")

    const row = page.locator('[data-component="home-session-row"]')
    await expectAppVisible(row)
    await expect(row).toContainText("Remote server session")

    await row.click()
    await expect(page).toHaveURL(new RegExp(`/session/${sessionID}$`))
    await expectAppVisible(page.locator('[data-component="mobile-nav"]'))
  })

  test("filters the list when a project is selected", async ({ page }) => {
    await installNativeShell(page)
    const projectA = "/tmp/opencode-e2e-project-a"
    const projectB = "/tmp/opencode-e2e-project-b"
    await seedMobileServer(page, { directory: projectA, projects: [projectA, projectB], selected: null })
    await mock(page, [
      {
        ...remoteSession,
        id: "ses_project_a",
        directory: projectA,
        title: "Alpha session",
        time: { created: 1, updated: 2 },
      },
      {
        ...remoteSession,
        id: "ses_project_b",
        directory: projectB,
        title: "Beta session",
        time: { created: 1, updated: 1 },
      },
    ])
    await page.goto("/")

    const projectRow = page.locator('[data-component="home-project-row"]', { hasText: "opencode-e2e-project-a" })
    await expect(page.locator('[data-component="home-session-row"]')).toHaveCount(2)
    await projectRow.click()
    await expect(page.locator('[data-component="home-session-row"]')).toHaveCount(1)
    await expect(page.locator('[data-component="home-session-row"]')).toContainText("Alpha session")

    await projectRow.click()
    await expect(page.locator('[data-component="home-session-row"]')).toHaveCount(2)
  })

  test("search narrows the session list", async ({ page }) => {
    await installNativeShell(page)
    await seedMobileServer(page, { directory, projects: [], selected: null })
    await mock(page, [
      { ...remoteSession, id: "ses_alpha", title: "Alpha session", time: { created: 1, updated: 2 } },
      { ...remoteSession, id: "ses_beta", title: "Beta session", time: { created: 1, updated: 1 } },
    ])
    await page.goto("/")

    const search = page.getByPlaceholder("Search sessions")
    await search.fill("Alpha")
    await expect(page.locator('[data-component="home-session-row"]')).toHaveCount(1)
    await expect(page.locator('[data-component="home-session-row"]')).toContainText("Alpha session")
    await expect(page.locator('[data-component="home-session-search-panel"]')).toHaveCount(0)

    await search.fill("no-such-session")
    await expect(page.locator('[data-component="home-session-row"]')).toHaveCount(0)
    await expect(page.getByText("No sessions found for no-such-session")).toBeVisible()
  })

  test("plain web stays empty for sessions outside local projects", async ({ page }) => {
    await seedMobileServer(page, { directory, projects: [] })
    await mock(page, [remoteSession])
    await page.goto("/")

    await expect(page.getByText("Nothing here yet")).toBeVisible()
    await expect(page.locator('[data-component="home-session-row"]')).toHaveCount(0)
  })

  test("shows the empty state when the server has no sessions", async ({ page }) => {
    await installNativeShell(page)
    await seedMobileServer(page, { directory, projects: [] })
    await mock(page, [])
    await page.goto("/")

    await expect(page.getByText("Nothing here yet")).toBeVisible()
  })

  test("truncates very long session titles", async ({ page }) => {
    await installNativeShell(page)
    await seedMobileServer(page, { directory, projects: [] })
    await mock(page, [{ ...remoteSession, title: longTitle }])
    await page.goto("/")

    const row = page.locator('[data-component="home-session-row"]')
    await expectAppVisible(row)
    const title = row.getByText(longTitle)
    await expect(title).toBeVisible()
    expect(await title.evaluate((element) => getComputedStyle(element).textOverflow)).toBe("ellipsis")
    const box = await row.boundingBox()
    expect(box).not.toBeNull()
    expect(box!.width).toBeLessThanOrEqual(390)
  })
})
