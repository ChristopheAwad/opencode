export type SaveDefaultModelInput = {
  protocol: "v1" | "v2" | undefined
  key: string
  previous: string | undefined
  set: (value: string | undefined) => void
  update: (config: { model: string }) => Promise<unknown>
  refresh: () => void
  onError: (error: unknown) => void
}

export async function saveDefaultModel(input: SaveDefaultModelInput) {
  if (input.protocol !== "v1") return
  if (input.key === input.previous) return
  input.set(input.key)
  try {
    await input.update({ model: input.key })
    input.refresh()
  } catch (error) {
    input.set(input.previous)
    input.onError(error)
  }
}
