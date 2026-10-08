import type { ServerConnection } from "@/context/server"
import { normalizeServerUrl } from "@/context/server"
import { authTokenFromCredentials } from "./server"

export type ServerProbeResult =
  | { kind: "healthy" }
  | { kind: "unauthorized" }
  | { kind: "unreachable" }
  | { kind: "invalid" }

export type MobileServerInput = { ok: true; url: string } | { ok: false; error: "empty" | "invalid" | "path" }

// Validates raw first-run input. normalizeServerUrl keeps paths and queries, so
// this rejects anything that is not a bare origin before that normalization.
export function validateMobileServerInput(raw: string): MobileServerInput {
  const trimmed = raw.trim().toLowerCase()
  if (!trimmed) return { ok: false, error: "empty" }
  const scheme = trimmed.match(/^([a-z][a-z0-9+.-]*):\/\//)
  if (scheme && scheme[1] !== "http" && scheme[1] !== "https") return { ok: false, error: "invalid" }
  if (/^javascript:/i.test(trimmed)) return { ok: false, error: "invalid" }

  const normalized = normalizeServerUrl(trimmed)
  if (!normalized) return { ok: false, error: "empty" }
  let url: URL
  try {
    url = new URL(normalized)
  } catch {
    return { ok: false, error: "invalid" }
  }
  if (url.pathname !== "/" || url.search || url.hash) return { ok: false, error: "path" }
  return { ok: true, url: normalized }
}

function isHealthPayload(value: unknown): boolean {
  if (typeof value !== "object" || value === null) return false
  const record = value as Record<string, unknown>
  return typeof record.healthy === "boolean" || typeof record.pid === "number"
}

export type ProbeFetch = (input: string | URL | Request, init?: RequestInit) => Promise<Response>

export type ProbeOptions = {
  timeoutMs?: number
  fetch?: ProbeFetch
  signal?: AbortSignal
}

// A single short request. Deliberately not checkServerHealth: that helper
// returns no status detail and defaults to a 30s timeout with retries, which
// would hang a phone submit and cannot tell a bad password from a dead host.
export async function probeServer(
  server: ServerConnection.HttpBase,
  opts: ProbeOptions = {},
): Promise<ServerProbeResult> {
  const fetcher = opts.fetch ?? globalThis.fetch
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 10_000)
  const onCallerAbort = () => controller.abort()
  opts.signal?.addEventListener("abort", onCallerAbort, { once: true })
  if (opts.signal?.aborted) controller.abort()

  try {
    const response = await fetcher(new URL("/api/health", server.url).toString(), {
      headers: server.password
        ? {
            Authorization: `Basic ${authTokenFromCredentials({
              username: server.username,
              password: server.password,
            })}`,
          }
        : undefined,
      signal: controller.signal,
    })
    if (response.status === 401) return { kind: "unauthorized" }
    if (!response.ok) return { kind: "invalid" }
    const body = await response.json().catch(() => undefined)
    return isHealthPayload(body) ? { kind: "healthy" } : { kind: "invalid" }
  } catch {
    return { kind: "unreachable" }
  } finally {
    clearTimeout(timer)
    opts.signal?.removeEventListener("abort", onCallerAbort)
  }
}
