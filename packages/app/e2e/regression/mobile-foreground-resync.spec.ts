import { expect, test, type Page } from "@playwright/test"
import { base64Encode } from "@opencode-ai/core/util/encode"
import { project } from "../performance/timeline-stability/fixture"
import {
  emitNativeAppState,
  installNativeShell,
  mockMobileServer,
  MOBILE_SERVER_URL,
  seedMobileServer,
} from "../utils/mobile-shell"
import { installSseTransport } from "../utils/sse-transport"
import { APP_READY_TIMEOUT, expectAppVisible } from "../utils/waits"

const directory = "/tmp/opencode-e2e-mobile-foreground"
const sessionID = "ses_mobile_foreground"

function userMessage(id: string, created: number, text: string) {
  return {
    info: {
      id,
      sessionID,
      role: "user",
      time: { created },
      summary: { diffs: [] },
      agent: "build",
      model: { providerID: "mock", modelID: "mock" },
    },
    parts: [{ id: `prt_${id}`, sessionID, messageID: id, type: "text" as const, text }],
  }
}

async function openSession(page: Page, input: { native?: boolean; initial?: number; sessionTitle?: string } = {}) {
  if (input.native ?? true) await installNativeShell(page)
  const transport = await installSseTransport(page, { server: MOBILE_SERVER_URL, retry: 20 })
  const messages = Array.from({ length: input.initial ?? 30 }, (_, index) =>
    userMessage(`msg_${index + 1}`, index + 1, `Message ${index + 1}`),
  )
  const limits: number[] = []
  const befores: Array<string | undefined> = []
  await mockMobileServer(page, {
    protocol: "v1",
    directory,
    project: { ...project(), id: "project", worktree: directory, directory },
    provider: { all: [], connected: [], default: {} },
    sessions: [
      {
        id: sessionID,
        slug: sessionID,
        projectID: "project",
        directory,
        title: input.sessionTitle ?? "Foreground session",
        version: "dev",
        time: { created: 1, updated: 2 },
      },
    ],
    pageMessages: (_sessionID, limit, before) => {
      limits.push(limit)
      befores.push(before)
      const end = before ? messages.findIndex((message) => message.info.id === before) : messages.length
      const start = Math.max(0, end - limit)
      return { items: messages.slice(start, end), cursor: start > 0 ? messages[start]!.info.id : undefined }
    },
  })
  await seedMobileServer(page, { directory })
  await page.addInitScript(() => {
    const current = JSON.parse(localStorage.getItem("settings.v3") ?? "{}")
    current.general = { ...(current.general ?? {}), shouldDisplayTabsToast: false }
    localStorage.setItem("settings.v3", JSON.stringify(current))
  })
  await page.goto(`/${base64Encode(directory)}/session/${sessionID}`)
  const latest = input.initial ?? 30
  await expectAppVisible(page.getByText(`Message ${latest}`, { exact: true }))
  const connection = await transport.waitForConnection()
  return { transport, messages, limits, befores, connection }
}

test.describe("mobile foreground resync", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true })

  test("closes the message gap after the app returns to the foreground", async ({ page }) => {
    const session = await openSession(page)
    const first = session.connection

    await session.transport.close()
    for (let index = 31; index <= 80; index++) {
      session.messages.push(userMessage(`msg_${index}`, index, `Message ${index}`))
    }

    await emitNativeAppState(page, false)
    await emitNativeAppState(page, true)

    const second = await session.transport.waitForConnection({ after: first.id })
    expect(second.id).toBeGreaterThan(first.id)

    await expect.poll(() => session.limits.includes(200)).toBe(true)
    expect(session.limits[0]).toBe(20)
    expect(session.limits).toContain(50)
    expect(session.befores).toContain("msg_31")

    const jump = page.getByRole("button", { name: "Jump to latest" })
    if (await jump.isVisible()) await jump.tap()
    await expect(page.getByText("Message 80", { exact: true })).toBeVisible({ timeout: APP_READY_TIMEOUT })
  })

  test("restarts a silent live stream when the app returns", async ({ page }) => {
    const session = await openSession(page)
    const first = session.connection

    await emitNativeAppState(page, false)
    await emitNativeAppState(page, true)

    const second = await session.transport.waitForConnection({ after: first.id })
    expect(second.id).toBeGreaterThan(first.id)
    const connections = await session.transport.connections()
    expect(connections.find((connection) => connection.id === first.id)?.endedBy).toBe("abort")
  })

  test("resyncs the web app when the tab becomes visible again", async ({ page }) => {
    const session = await openSession(page, { native: false })
    const first = session.connection

    await session.transport.close()
    for (let index = 31; index <= 80; index++) {
      session.messages.push(userMessage(`msg_${index}`, index, `Message ${index}`))
    }

    await page.evaluate(() => {
      Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" })
      document.dispatchEvent(new Event("visibilitychange"))
      Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "visible" })
      document.dispatchEvent(new Event("visibilitychange"))
    })

    const second = await session.transport.waitForConnection({ after: first.id })
    expect(second.id).toBeGreaterThan(first.id)
    await expect.poll(() => session.limits.includes(200)).toBe(true)

    const jump = page.getByRole("button", { name: "Jump to latest" })
    if (await jump.isVisible()) await jump.tap()
    await expect(page.getByText("Message 80", { exact: true })).toBeVisible({ timeout: APP_READY_TIMEOUT })
  })
})
