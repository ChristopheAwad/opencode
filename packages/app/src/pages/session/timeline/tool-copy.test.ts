import { describe, expect, test } from "bun:test"
import type { ToolPart } from "@opencode-ai/sdk/v2/client"
import { completedToolOutput } from "./tool-copy"

function tool(state: ToolPart["state"]): ToolPart {
  return { id: "prt", sessionID: "ses", messageID: "msg", type: "tool", callID: "call", tool: "bash", state }
}

describe("completedToolOutput", () => {
  test("returns the output of a completed tool", () => {
    expect(
      completedToolOutput(
        tool({
          status: "completed",
          input: {},
          output: "hello",
          title: "bash",
          metadata: {},
          time: { start: 0, end: 1 },
        }),
      ),
    ).toBe("hello")
  })

  test("returns undefined for pending, running, and error states", () => {
    expect(completedToolOutput(tool({ status: "pending", input: {}, raw: "" }))).toBeUndefined()
    expect(
      completedToolOutput(tool({ status: "running", input: {}, metadata: {}, time: { start: 0 } })),
    ).toBeUndefined()
    expect(
      completedToolOutput(
        tool({ status: "error", input: {}, error: "boom", metadata: {}, time: { start: 0, end: 1 } }),
      ),
    ).toBeUndefined()
  })

  test("returns undefined for empty or whitespace-only output", () => {
    expect(
      completedToolOutput(
        tool({ status: "completed", input: {}, output: "", title: "bash", metadata: {}, time: { start: 0, end: 1 } }),
      ),
    ).toBeUndefined()
    expect(
      completedToolOutput(
        tool({
          status: "completed",
          input: {},
          output: "   \n",
          title: "bash",
          metadata: {},
          time: { start: 0, end: 1 },
        }),
      ),
    ).toBeUndefined()
  })

  test("returns undefined for non-tool parts and missing parts", () => {
    expect(completedToolOutput(undefined)).toBeUndefined()
    expect(completedToolOutput({ type: "text" })).toBeUndefined()
  })
})
