import { expect, test, type Page } from "@playwright/test"
import { base64Encode } from "@opencode-ai/core/util/encode"
import { project } from "../performance/timeline-stability/fixture"
import { installNativeShell, mockMobileServer, seedMobileServer } from "../utils/mobile-shell"
import { expectAppVisible } from "../utils/waits"

const directory = "/tmp/opencode-e2e-mobile-tool-copy"
const sessionID = "ses_mobile_tool_copy"
const userID = "msg_tool_copy_user"
const assistantID = "msg_tool_copy_assistant"
const shellID = "prt_tool_copy_shell"
const userTextID = "prt_tool_copy_user_text"

async function openSession(page: Page, output: string, input: { native?: boolean } = {}) {
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
    sessions: [
      {
        id: sessionID,
        slug: sessionID,
        projectID: "project",
        directory,
        title: "Tool copy session",
        version: "dev",
        time: { created: 1700000000000, updated: 1700000002000 },
      },
    ],
    pageMessages: () => ({
      items: [
        {
          info: {
            id: userID,
            sessionID,
            role: "user",
            time: { created: 1700000000000 },
            summary: { diffs: [] },
            agent: "build",
            model: { providerID: "anthropic", modelID: "test-model" },
          },
          parts: [{ id: userTextID, sessionID, messageID: userID, type: "text", text: "run it" }],
        },
        {
          info: {
            id: assistantID,
            sessionID,
            role: "assistant",
            time: { created: 1700000001000, completed: 1700000002000 },
            parentID: userID,
            modelID: "test-model",
            providerID: "anthropic",
            mode: "build",
            agent: "build",
            path: { cwd: directory, root: directory },
            cost: 0,
            tokens: { input: 10, output: 20, reasoning: 0, cache: { read: 0, write: 0 } },
          },
          parts: [
            {
              id: shellID,
              sessionID,
              messageID: assistantID,
              type: "tool",
              callID: "call_tool_copy",
              tool: "bash",
              state: {
                status: "completed",
                input: { command: "echo output" },
                output,
                title: "echo output",
                metadata: { command: "echo output", output },
                time: { start: 1700000001000, end: 1700000002000 },
              },
            },
          ],
        },
      ],
    }),
  })
  await page.goto(`/${base64Encode(directory)}/session/${sessionID}`)
  await expectAppVisible(page.locator(`[data-timeline-part-id="${shellID}"]`))
}

async function longPress(page: Page, target: ReturnType<Page["locator"]>) {
  await page.clock.install()
  const box = await target.boundingBox()
  expect(box).not.toBeNull()
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2)
  await page.mouse.down()
  await page.clock.fastForward(600)
  await page.mouse.up()
  await page.clock.fastForward(701)
  await page.clock.resume()
}

function clipboard(page: Page) {
  return page.evaluate(() => navigator.clipboard.readText())
}

test.describe("native tool output copy", () => {
  test.use({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    permissions: ["clipboard-read", "clipboard-write"],
  })

  test("long-press copies the completed tool output", async ({ page }) => {
    await openSession(page, "long press output text")
    const trigger = page.locator(`[data-timeline-part-id="${shellID}"] [data-slot="collapsible-trigger"]`)

    const nativeBox = await trigger.boundingBox()
    expect(nativeBox).not.toBeNull()
    expect(nativeBox!.height).toBeGreaterThanOrEqual(44)

    await longPress(page, trigger)
    await expect.poll(() => clipboard(page)).toBe("long press output text")
  })

  test("plain web keeps the smaller tool trigger", async ({ page }) => {
    await openSession(page, "web output", { native: false })
    const trigger = page.locator(`[data-timeline-part-id="${shellID}"] [data-slot="collapsible-trigger"]`)

    await expect(trigger).toBeVisible()
    const box = await trigger.boundingBox()
    expect(box).not.toBeNull()
    expect(box!.height).toBeLessThan(44)
  })

  test("long-press on a text part leaves the clipboard alone", async ({ page }) => {
    await openSession(page, "some output")
    await page.evaluate(() => navigator.clipboard.writeText("sentinel"))
    const userPart = page.locator(`[data-timeline-part-id="${userTextID}"]`)

    await longPress(page, userPart)
    await expect.poll(() => clipboard(page)).toBe("sentinel")
  })

  test("long-press with empty output leaves the clipboard alone", async ({ page }) => {
    await openSession(page, "")
    await page.evaluate(() => navigator.clipboard.writeText("sentinel"))
    const trigger = page.locator(`[data-timeline-part-id="${shellID}"] [data-slot="collapsible-trigger"]`)

    await longPress(page, trigger)
    await expect.poll(() => clipboard(page)).toBe("sentinel")
  })
})
