export function hasCustomAgent(items: Array<{ native?: boolean }>) {
  return items.some((item) => item.native === false)
}

// The native shell always exposes the agent selector when agents exist, even
// when the custom-agent visibility preference is off.
export function agentControlVisible(input: { configured: boolean; native: boolean; options: number }) {
  return (input.configured || input.native) && input.options > 0
}

export function resolveAgent<T extends { name: string }>(items: T[], name?: string) {
  return items.find((item) => item.name === name) ?? items.find((item) => item.name === "build") ?? items[0]
}
