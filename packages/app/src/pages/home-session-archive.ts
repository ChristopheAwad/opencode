import { notifySessionTabsRemoved } from "@/components/titlebar-session-events"
import type { ServerConnection } from "@/context/server"

type HomeSession = {
  id: string
  directory: string
}

// Coalesce duplicate archive taps for the same session while the first request
// is in flight.
const inflight = new Map<string, Promise<void>>()

export async function archiveHomeSession(input: {
  server: ServerConnection.Key
  session: HomeSession
  archive: (sessionID: string) => Promise<unknown>
  remove: () => void
  onError?: (error: unknown) => void
}) {
  const pending = inflight.get(input.session.id)
  if (pending) return pending
  const run = input
    .archive(input.session.id)
    .then(() => {
      input.remove()
      notifySessionTabsRemoved({
        server: input.server,
        directory: input.session.directory,
        sessionIDs: [input.session.id],
      })
    })
    .catch((error) => input.onError?.(error))
  inflight.set(input.session.id, run)
  try {
    await run
  } finally {
    if (inflight.get(input.session.id) === run) inflight.delete(input.session.id)
  }
}
