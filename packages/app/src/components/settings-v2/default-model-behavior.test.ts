import { describe, expect, test } from "bun:test"
import { saveDefaultModel } from "./default-model-behavior"

function setup(overrides: Partial<Parameters<typeof saveDefaultModel>[0]> = {}) {
  const updates: string[] = []
  const refreshes: number[] = []
  const errors: unknown[] = []
  const values: (string | undefined)[] = []
  const input = {
    protocol: "v1" as const,
    key: "anthropic/claude",
    previous: undefined as string | undefined,
    set: (value: string | undefined) => values.push(value),
    update: async (config: { model: string }) => {
      updates.push(config.model)
    },
    refresh: () => refreshes.push(1),
    onError: (error: unknown) => errors.push(error),
    ...overrides,
  }
  return { input, updates, refreshes, errors, values }
}

describe("saveDefaultModel", () => {
  test("saves optimistically and refreshes after the update", async () => {
    const { input, updates, refreshes, values } = setup()
    await saveDefaultModel(input)
    expect(values).toEqual(["anthropic/claude"])
    expect(updates).toEqual(["anthropic/claude"])
    expect(refreshes).toEqual([1])
  })

  test("rolls back and reports the error when the update fails", async () => {
    const failure = new Error("offline")
    const { input, updates, refreshes, errors, values } = setup({
      previous: "openai/gpt-5",
      update: async (config: { model: string }) => {
        updates.push(config.model)
        throw failure
      },
    })
    await saveDefaultModel(input)
    expect(values).toEqual(["anthropic/claude", "openai/gpt-5"])
    expect(updates).toEqual(["anthropic/claude"])
    expect(refreshes).toEqual([])
    expect(errors).toEqual([failure])
  })

  test("does nothing when the value is unchanged", async () => {
    const { input, updates, refreshes, values } = setup({ previous: "anthropic/claude" })
    await saveDefaultModel(input)
    expect(values).toEqual([])
    expect(updates).toEqual([])
    expect(refreshes).toEqual([])
  })

  test("does nothing on protocol v2", async () => {
    const { input, updates, refreshes, values } = setup({ protocol: "v2" })
    await saveDefaultModel(input)
    expect(values).toEqual([])
    expect(updates).toEqual([])
    expect(refreshes).toEqual([])
  })

  test("does nothing while the protocol is unresolved", async () => {
    const { input, updates, refreshes, values } = setup({ protocol: undefined })
    await saveDefaultModel(input)
    expect(values).toEqual([])
    expect(updates).toEqual([])
    expect(refreshes).toEqual([])
  })
})
