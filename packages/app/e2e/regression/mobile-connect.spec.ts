import { expect, test, type Page } from "@playwright/test"
import { project } from "../performance/timeline-stability/fixture"
import { mockOpenCodeServer } from "../utils/mock-server"

const directory = "/tmp/opencode-e2e-mobile"
const defaultServerKey = "opencode.settings.dat:defaultServerUrl"

async function installNativeShell(page: Page) {
  await page.addInitScript(() => {
    Object.assign(window, { Capacitor: { isNativePlatform: () => true } })
  })
}

function mobileMock(page: Page) {
  return mockOpenCodeServer(page, {
    protocol: "v2",
    directory,
    project: { ...project(), worktree: directory, directory },
    provider: { all: [], connected: [], default: {} },
    sessions: [],
    pageMessages: () => ({ items: [] }),
  })
}

test.describe("mobile first-run connect", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true })

  test("shows the connect form on a fresh native launch", async ({ page }) => {
    await installNativeShell(page)
    await page.goto("/")

    await expect(page.getByRole("heading", { name: "Add server" })).toBeVisible()
    await expect(page.getByLabel("Server address")).toHaveValue("http://")
    await expect(page.getByLabel("Username (optional)")).toHaveValue("opencode")
  })

  test("rejects malformed input without sending a request", async ({ page }) => {
    await installNativeShell(page)
    let requests = 0
    await page.route("**/api/health", (route) => {
      requests++
      return route.fulfill({ status: 200, body: JSON.stringify({ healthy: true }) })
    })
    await page.goto("/")

    await page.getByLabel("Server address").fill("ftp://host")
    await page.getByRole("button", { name: "Connect" }).click()

    await expect(page.getByText("Could not connect to server")).toBeVisible()
    expect(requests).toBe(0)
  })

  test("reports an unreachable server", async ({ page }) => {
    await installNativeShell(page)
    await page.goto("/")

    await page.getByLabel("Server address").fill("http://127.0.0.1:59999")
    await page.getByRole("button", { name: "Connect" }).click()

    await expect(page.getByText(/Is there a server running at/)).toBeVisible()
    await expect(page.getByRole("heading", { name: "Add server" })).toBeVisible()
  })

  test("reports rejected credentials", async ({ page }) => {
    await installNativeShell(page)
    await page.route("**/api/health", (route) => route.fulfill({ status: 401, body: "unauthorized" }))
    await page.goto("/")

    await page.getByLabel("Server address").fill("http://127.0.0.1:4096")
    await page.getByRole("button", { name: "Connect" }).click()

    await expect(page.getByRole("heading", { name: "Add server" })).toBeVisible()
    await expect(page.getByText("Could not connect to server")).toBeVisible()
  })

  test("saves a healthy server and boots the app", async ({ page }) => {
    await installNativeShell(page)
    await mobileMock(page)
    await page.goto("/")

    await page.getByLabel("Server address").fill("http://127.0.0.1:4096")
    await page.getByRole("button", { name: "Connect" }).click()

    await expect(page.getByRole("heading", { name: "Add server" })).toBeHidden()
    await expect(page.locator('[data-slot="titlebar-v2"]')).toBeVisible()
    expect(await page.evaluate((key) => localStorage.getItem(key), defaultServerKey)).toBe("http://127.0.0.1:4096")
  })

  test("skips the form when a default server is already stored", async ({ page }) => {
    await installNativeShell(page)
    await page.addInitScript((key) => {
      localStorage.setItem(key, "http://127.0.0.1:4096")
      localStorage.setItem("opencode.global.dat:server", JSON.stringify({ list: ["http://127.0.0.1:4096"] }))
    }, defaultServerKey)
    await mobileMock(page)
    await page.goto("/")

    await expect(page.locator('[data-slot="titlebar-v2"]')).toBeVisible()
    await expect(page.getByRole("heading", { name: "Add server" })).toBeHidden()
  })

  test("offers the connect screen when the stored server is unreachable", async ({ page }) => {
    await installNativeShell(page)
    await page.addInitScript((key) => {
      if (sessionStorage.getItem("e2e-seeded")) return
      sessionStorage.setItem("e2e-seeded", "1")
      localStorage.setItem(key, "http://127.0.0.1:59999")
      localStorage.setItem("opencode.global.dat:server", JSON.stringify({ list: ["http://127.0.0.1:59999"] }))
    }, defaultServerKey)
    await page.goto("/")

    await expect(page.getByText("Retrying automatically...")).toBeVisible()
    await page.getByRole("button", { name: "Switch server" }).click()

    await expect(page.getByRole("heading", { name: "Add server" })).toBeVisible()
  })

  test("keeps the form when storage rejects the default server", async ({ page }) => {
    await installNativeShell(page)
    await page.addInitScript((key) => {
      const original = localStorage.setItem.bind(localStorage)
      localStorage.setItem = (name, value) => {
        if (name === key) throw new Error("quota exceeded")
        original(name, value)
      }
    }, defaultServerKey)
    await mobileMock(page)
    await page.goto("/")

    await page.getByLabel("Server address").fill("http://127.0.0.1:4096")
    await page.getByRole("button", { name: "Connect" }).click()

    await expect(page.getByRole("heading", { name: "Add server" })).toBeVisible()
    await expect(page.getByText("Could not connect to server")).toBeVisible()
  })
})
