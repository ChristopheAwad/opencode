import type { ToolPart } from "@opencode-ai/sdk/v2/client"

export function completedToolOutput(part: { type: string; state?: ToolPart["state"] } | undefined): string | undefined {
  if (!part || part.type !== "tool" || !part.state) return undefined
  if (part.state.status !== "completed") return undefined
  const output = part.state.output
  if (!output.trim()) return undefined
  return output
}
