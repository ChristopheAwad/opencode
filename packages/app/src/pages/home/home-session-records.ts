import type { Session } from "@opencode-ai/sdk/v2/client"
import type { LocalProject } from "@/context/layout"
import { compareSessionTime, displayName, projectForSession } from "@/pages/layout/helpers"
import { pathKey } from "@/utils/path-key"

export type HomeSessionRecord = {
  session: Session
  project: LocalProject
  projectName: string
}

export function buildHomeSessionRecords(input: {
  sessions: () => Session[]
  projectDirectories: () => string[]
  projects: () => LocalProject[]
  projectByID: () => Map<string, LocalProject>
  native: boolean
}) {
  const directories = new Set(input.projectDirectories().map(pathKey))
  const sessions = input.native
    ? input.sessions().filter((session) => !!session.directory)
    : input.sessions().filter((session) => directories.has(pathKey(session.directory)))
  return [...new Map(sessions.map((session) => [session.id, session] as const)).values()]
    .sort(compareSessionTime)
    .flatMap((session) => {
      const directory = pathKey(session.directory)
      const project =
        input
          .projects()
          .find(
            (item) =>
              pathKey(item.worktree) === directory || item.sandboxes?.some((sandbox) => pathKey(sandbox) === directory),
          ) ??
        projectForSession(session, input.projects(), input.projectByID()) ??
        (input.native ? ({ worktree: session.directory, expanded: true } satisfies LocalProject) : undefined)
      if (!project) return []
      return { session, project, projectName: displayName(project) }
    })
}
