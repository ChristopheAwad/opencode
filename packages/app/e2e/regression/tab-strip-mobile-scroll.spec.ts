import { expect, test, type Page, type Route } from "@playwright/test"
import { base64Encode } from "@opencode-ai/core/util/encode"
import { currentSession } from "../utils/mock-server"

const server = "http://127.0.0.1:4096"
const sessionA = session("ses_tab_scroll_a", "Scroll Tab A")
const sessionB = session("ses_tab_scroll_b", "Scroll Tab B")
const sessionC = session("ses_tab_scroll_c", "Scroll Tab C")
const sessionD = session("ses_tab_scroll_d", "Scroll Tab D")
const sessions = [sessionA, sessionB, sessionC, sessionD]

const hrefA = `/server/${base64Encode(server)}/session/${sessionA.id}`
const hrefB = `/server/${base64Encode(server)}/session/${sessionB.id}`
const hrefC = `/server/${base64Encode(server)}/session/${sessionC.id}`

test("mobile tab strip keeps tabs full width and scrolls horizontally", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await mockServer(page)
  await seedTabs(page, [sessionA, sessionB, sessionC])
  await page.goto(hrefA)

  const slots = page.locator("[data-titlebar-tab-slot]:visible")
  await expect(slots).toHaveCount(3)
  await expect(page.locator("[data-titlebar-tab-title]").first()).toBeVisible()

  const metrics = await scrollMetrics(page)
  expect(metrics.widths).toHaveLength(3)
  for (const width of metrics.widths) {
    expect(width).toBeGreaterThan(100)
    expect(width).toBeLessThanOrEqual(225)
  }
  expect(Math.abs(metrics.widths[0] - metrics.widths[1])).toBeLessThanOrEqual(2)
  expect(metrics.widths[0] * 2 + 6).toBeLessThanOrEqual(metrics.clientWidth + 1)
  expect(metrics.rightEdges[1]).toBeLessThanOrEqual(metrics.clientWidth + 1)
  expect(metrics.rightEdges[2]).toBeGreaterThan(metrics.clientWidth)
  expect(metrics.scrollWidth).toBeGreaterThan(metrics.clientWidth)
})

test("two mobile tabs fill the strip without scrolling", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await mockServer(page)
  await seedTabs(page, [sessionA, sessionB])
  await page.goto(hrefA)

  await expect(page.locator("[data-titlebar-tab-slot]:visible")).toHaveCount(2)

  const metrics = await scrollMetrics(page)
  expect(metrics.widths).toHaveLength(2)
  expect(metrics.scrollWidth).toBe(metrics.clientWidth)
  expect(metrics.rightEdges[1]).toBeLessThanOrEqual(metrics.clientWidth + 1)
  for (const width of metrics.widths) expect(width).toBeGreaterThan(100)
  expect(Math.abs(metrics.widths[0] - metrics.widths[1])).toBeLessThanOrEqual(2)
})

test("selecting an off-screen mobile tab scrolls it into view", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await mockServer(page)
  await seedTabs(page, [sessionA, sessionB, sessionC])
  await page.goto(hrefA)

  await expect(page.locator("[data-titlebar-tab-slot]:visible")).toHaveCount(3)

  await page.keyboard.press("Control+Alt+ArrowRight")
  await expect(page).toHaveURL(new RegExp(`${escapeRegExp(hrefB)}$`))
  await page.keyboard.press("Control+Alt+ArrowRight")
  await expect(page).toHaveURL(new RegExp(`${escapeRegExp(hrefC)}$`))

  const scroll = page.locator('[data-slot="titlebar-tabs-scroll"]')
  await expect.poll(() => scroll.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0)

  const active = await scroll.evaluate((el) => {
    const container = el.getBoundingClientRect()
    const slot = el.querySelector<HTMLElement>('[data-titlebar-tab-slot][data-active="true"]')
    if (!slot) return null
    const rect = slot.getBoundingClientRect()
    return { left: rect.left - container.left, right: rect.right - container.left, clientWidth: el.clientWidth }
  })
  expect(active).not.toBeNull()
  expect(active!.left).toBeGreaterThanOrEqual(-1)
  expect(active!.right).toBeLessThanOrEqual(active!.clientWidth + 1)
})

test("desktop tab strip still shrinks tabs instead of scrolling", async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 900 })
  await mockServer(page)
  await seedTabs(page, [sessionA, sessionB, sessionC, sessionD])
  await page.goto(hrefA)

  const slots = page.locator("[data-titlebar-tab-slot]:visible")
  await expect(slots).toHaveCount(4)

  const metrics = await scrollMetrics(page)
  expect(metrics.scrollWidth).toBe(metrics.clientWidth)
  for (const width of metrics.widths) {
    expect(width).toBeLessThan(224)
    expect(width).toBeGreaterThan(64)
  }
})

async function scrollMetrics(page: Page) {
  return page.locator('[data-slot="titlebar-tabs-scroll"]').evaluate((el) => {
    const container = el.getBoundingClientRect()
    const rects = Array.from(el.querySelectorAll<HTMLElement>("[data-titlebar-tab-slot]")).map((slot) =>
      slot.getBoundingClientRect(),
    )
    return {
      clientWidth: el.clientWidth,
      scrollWidth: el.scrollWidth,
      scrollLeft: el.scrollLeft,
      widths: rects.map((rect) => rect.width),
      leftEdges: rects.map((rect) => rect.left - container.left),
      rightEdges: rects.map((rect) => rect.right - container.left),
    }
  })
}

async function seedTabs(page: Page, tabs: ReturnType<typeof session>[]) {
  await page.addInitScript(
    ({ server, ids }) => {
      localStorage.setItem("settings.v3", JSON.stringify({ general: { newLayoutDesigns: true } }))
      localStorage.setItem(
        "opencode.window.browser.dat:tabs",
        JSON.stringify(ids.map((sessionId) => ({ type: "session", server, sessionId }))),
      )
    },
    { server, ids: tabs.map((tab) => tab.id) },
  )
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function session(id: string, title: string) {
  return {
    id,
    slug: id,
    projectID: "project-tabs",
    directory: "C:/tab-project",
    title,
    version: "dev",
    time: { created: 1, updated: 1 },
  }
}

async function mockServer(page: Page) {
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url())
    if (url.origin !== server) return route.fallback()
    if (url.pathname === "/global/event" || url.pathname === "/event" || url.pathname === "/api/event")
      return sse(route)
    if (url.pathname === "/global/health") return json(route, { healthy: true })
    if (url.pathname === "/api/session") return json(route, { data: sessions.map(currentSession), cursor: {} })
    if (url.pathname === "/api/session/active") return json(route, { data: {} })
    const currentSessionInfo = sessions.find((item) => url.pathname === `/api/session/${item.id}`)
    if (currentSessionInfo) return json(route, { data: currentSession(currentSessionInfo) })
    if (sessions.some((item) => url.pathname === `/api/session/${item.id}/message`))
      return json(route, { data: [], cursor: {} })
    const byId = sessions.find((item) => url.pathname === `/session/${item.id}`)
    if (byId) return json(route, byId)
    if (/^\/session\/[^/]+$/.test(url.pathname)) return json(route, { name: "NotFoundError" }, 404)
    if (/^\/session\/[^/]+\/message$/.test(url.pathname)) return json(route, [])
    if (/^\/session\/[^/]+\/(children|todo|diff)$/.test(url.pathname)) return json(route, [])
    if (["/skill", "/command", "/lsp", "/formatter", "/permission", "/question", "/vcs/diff"].includes(url.pathname))
      return json(route, [])
    if (["/global/config", "/config", "/provider/auth", "/mcp"].includes(url.pathname)) return json(route, {})
    if (url.pathname === "/provider")
      return json(route, { all: [], connected: [], default: { providerID: "", modelID: "" } })
    if (url.pathname === "/agent") return json(route, [{ name: "build", mode: "primary" }])
    if (url.pathname === "/project" || url.pathname === "/project/current") {
      const project = {
        id: sessionA.projectID,
        worktree: sessionA.directory,
        vcs: "git",
        time: { created: 1, updated: 1 },
        sandboxes: [],
      }
      return json(route, url.pathname === "/project" ? [project] : project)
    }
    if (url.pathname === "/path")
      return json(route, {
        state: sessionA.directory,
        config: sessionA.directory,
        worktree: sessionA.directory,
        directory: sessionA.directory,
        home: sessionA.directory,
      })
    if (url.pathname === "/api/path")
      return json(route, {
        state: sessionA.directory,
        config: sessionA.directory,
        worktree: sessionA.directory,
        directory: sessionA.directory,
        home: sessionA.directory,
      })
    if (url.pathname === "/vcs") return json(route, { branch: "main", default_branch: "main" })
    if (url.pathname === "/api/vcs")
      return json(route, {
        location: { directory: sessionA.directory },
        data: { branch: "main", defaultBranch: "main" },
      })
    return json(route, {})
  })
}

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({
    status,
    contentType: "application/json",
    headers: { "access-control-allow-origin": "*" },
    body: JSON.stringify(body),
  })
}

function sse(route: Route) {
  return route.fulfill({ status: 200, contentType: "text/event-stream", body: ": ok\n\n" })
}
