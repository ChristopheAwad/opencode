import { describe, expect, test } from "bun:test"
import { probeServer, validateMobileServerInput } from "./server-probe"

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } })

describe("validateMobileServerInput", () => {
  test("rejects empty and whitespace input", () => {
    expect(validateMobileServerInput("")).toEqual({ ok: false, error: "empty" })
    expect(validateMobileServerInput("   ")).toEqual({ ok: false, error: "empty" })
  })

  test("rejects malformed and non-http addresses", () => {
    expect(validateMobileServerInput("javascript:alert(1)")).toEqual({ ok: false, error: "invalid" })
    expect(validateMobileServerInput("ftp://host")).toEqual({ ok: false, error: "invalid" })
    expect(validateMobileServerInput("http://")).toEqual({ ok: false, error: "invalid" })
  })

  test("rejects paths, queries, and fragments", () => {
    expect(validateMobileServerInput("http://192.168.1.5:4096/api")).toEqual({ ok: false, error: "path" })
    expect(validateMobileServerInput("http://192.168.1.5:4096/?x=1")).toEqual({ ok: false, error: "path" })
    expect(validateMobileServerInput("http://192.168.1.5:4096/#top")).toEqual({ ok: false, error: "path" })
  })

  test("normalizes bare hosts, trailing slashes, and uppercase schemes", () => {
    expect(validateMobileServerInput("192.168.1.5:4096")).toEqual({ ok: true, url: "http://192.168.1.5:4096" })
    expect(validateMobileServerInput("  192.168.1.5:4096/  ")).toEqual({ ok: true, url: "http://192.168.1.5:4096" })
    expect(validateMobileServerInput("HTTP://192.168.1.5:4096")).toEqual({ ok: true, url: "http://192.168.1.5:4096" })
    expect(validateMobileServerInput("localhost:4096")).toEqual({ ok: true, url: "http://localhost:4096" })
  })
})

describe("probeServer", () => {
  test("healthy v2 payload", async () => {
    const result = await probeServer(
      { url: "http://192.168.1.5:4096" },
      { fetch: () => Promise.resolve(json({ healthy: true, pid: 42 })) },
    )
    expect(result).toEqual({ kind: "healthy" })
  })

  test("healthy v1 payload", async () => {
    const result = await probeServer(
      { url: "http://192.168.1.5:4096" },
      { fetch: () => Promise.resolve(json({ healthy: true })) },
    )
    expect(result).toEqual({ kind: "healthy" })
  })

  test("unauthorized", async () => {
    const result = await probeServer(
      { url: "http://192.168.1.5:4096", password: "wrong" },
      { fetch: () => Promise.resolve(new Response("no", { status: 401 })) },
    )
    expect(result).toEqual({ kind: "unauthorized" })
  })

  test("connection failure", async () => {
    const result = await probeServer(
      { url: "http://192.168.1.5:4096" },
      { fetch: () => Promise.reject(new TypeError("fetch failed")) },
    )
    expect(result).toEqual({ kind: "unreachable" })
  })

  test("timeout aborts the request", async () => {
    let calls = 0
    const result = await probeServer(
      { url: "http://192.168.1.5:4096" },
      {
        timeoutMs: 5,
        fetch: (_input, init) => {
          calls++
          return new Promise((_, reject) => {
            init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")))
          })
        },
      },
    )
    expect(result).toEqual({ kind: "unreachable" })
    expect(calls).toBe(1)
  })

  test("caller abort makes the probe unreachable", async () => {
    let calls = 0
    const controller = new AbortController()
    const probe = probeServer(
      { url: "http://192.168.1.5:4096" },
      {
        signal: controller.signal,
        fetch: (_input, init) => {
          calls++
          return new Promise((_, reject) => {
            init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")))
          })
        },
      },
    )
    controller.abort()
    expect(await probe).toEqual({ kind: "unreachable" })
    expect(calls).toBe(1)
  })

  test("html body is not a health payload", async () => {
    const result = await probeServer(
      { url: "http://192.168.1.5:4096" },
      { fetch: () => Promise.resolve(new Response("<html></html>", { status: 200 })) },
    )
    expect(result).toEqual({ kind: "invalid" })
  })

  test("unrelated json is not a health payload", async () => {
    const result = await probeServer(
      { url: "http://192.168.1.5:4096" },
      { fetch: () => Promise.resolve(json({ hello: "world" })) },
    )
    expect(result).toEqual({ kind: "invalid" })
  })

  test("sends basic auth only when a password is set", async () => {
    const headers: Array<Record<string, string> | undefined> = []
    const fetcher = (_input: string | URL | Request, init?: RequestInit) => {
      headers.push(init?.headers as Record<string, string> | undefined)
      return Promise.resolve(json({ healthy: true }))
    }
    await probeServer({ url: "http://192.168.1.5:4096" }, { fetch: fetcher })
    await probeServer({ url: "http://192.168.1.5:4096", username: "opencode", password: "secret" }, { fetch: fetcher })
    expect(headers[0]).toBeUndefined()
    expect(headers[1]?.Authorization).toBe(`Basic ${Buffer.from("opencode:secret").toString("base64")}`)
  })
})
