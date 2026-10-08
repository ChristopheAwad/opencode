import { expect, test } from "@playwright/test"
import { setupTimeline } from "../performance/timeline-stability/fixture"

const indicator = '[data-component="reconnect-indicator-v2"]'

test.describe("reconnect indicator", () => {
  test("is hidden while the event stream is live", async ({ page }) => {
    await setupTimeline(page)
    await expect(page.locator(indicator)).toBeHidden()
  })

  test("appears after a disconnect and clears after reconnect", async ({ page }) => {
    const timeline = await setupTimeline(page)
    const first = await timeline.transport.waitForConnection()

    await timeline.transport.close()
    await expect(page.locator(indicator)).toBeVisible()

    const second = await timeline.transport.waitForConnection({ after: first.id })
    expect(second.id).toBeGreaterThan(first.id)
    await expect(page.locator(indicator)).toBeHidden()
  })

  test("reconnects immediately when the indicator is clicked", async ({ page }) => {
    const timeline = await setupTimeline(page)
    const first = await timeline.transport.waitForConnection()

    await timeline.transport.close()
    await expect(page.locator(indicator)).toBeVisible()
    await page.locator(indicator).click()

    const second = await timeline.transport.waitForConnection({ after: first.id })
    expect(second.id).toBeGreaterThan(first.id)
    await expect(page.locator(indicator)).toBeHidden()
  })
})
