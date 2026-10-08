import { describe, expect, test } from "bun:test"
import { agentControlVisible, hasCustomAgent, resolveAgent } from "./local-agent"

describe("hasCustomAgent", () => {
  test("detects explicitly custom agents", () => {
    expect(hasCustomAgent([{ native: true }, { native: false }])).toBe(true)
  })

  test("ignores built-in and unclassified agents", () => {
    expect(hasCustomAgent([{ native: true }, {}])).toBe(false)
  })
})

describe("agentControlVisible", () => {
  test("shows on native even when the preference is off", () => {
    expect(agentControlVisible({ configured: false, native: true, options: 1 })).toBe(true)
  })

  test("honors the preference on web", () => {
    expect(agentControlVisible({ configured: false, native: false, options: 1 })).toBe(false)
    expect(agentControlVisible({ configured: true, native: false, options: 1 })).toBe(true)
  })

  test("hides when there are no agents to choose", () => {
    expect(agentControlVisible({ configured: true, native: true, options: 0 })).toBe(false)
  })
})

describe("resolveAgent", () => {
  const agents = [{ name: "plan" }, { name: "build" }, { name: "custom" }]

  test("uses the requested available agent", () => {
    expect(resolveAgent(agents, "custom")?.name).toBe("custom")
  })

  test("defaults to build", () => {
    expect(resolveAgent(agents)?.name).toBe("build")
    expect(resolveAgent(agents, "missing")?.name).toBe("build")
  })

  test("uses the first agent when build is unavailable", () => {
    expect(resolveAgent([{ name: "custom" }], "missing")?.name).toBe("custom")
  })
})
