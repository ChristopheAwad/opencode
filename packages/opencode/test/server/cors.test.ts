import { describe, expect, test } from "bun:test"
import { isAllowedCorsOrigin, isAllowedRequestOrigin } from "@opencode-ai/server/cors"

const allowedOrigins = [
  undefined,
  "https://localhost",
  "http://localhost",
  "https://localhost:8443",
  "http://localhost:5173",
  "http://127.0.0.1",
  "http://127.0.0.1:4096",
  "capacitor://localhost",
  "tauri://localhost",
  "http://tauri.localhost",
  "https://tauri.localhost",
  "https://app.opencode.ai",
  "https://foo.opencode.ai",
]

const rejectedOrigins = [
  "https://localhost.evil.com",
  "https://evil.example",
  "http://127.0.0.1.evil.com",
  "ftp://localhost",
]

describe("isAllowedCorsOrigin", () => {
  test("allows localhost, Capacitor, Tauri, and opencode.ai origins", () => {
    for (const origin of allowedOrigins) expect([origin, isAllowedCorsOrigin(origin)]).toEqual([origin, true])
  })

  test("rejects lookalike and foreign origins", () => {
    for (const origin of rejectedOrigins) expect([origin, isAllowedCorsOrigin(origin)]).toEqual([origin, false])
  })

  test("honors configured extra origins", () => {
    expect(isAllowedCorsOrigin("https://my.example", { cors: ["https://my.example"] })).toBe(true)
    expect(isAllowedCorsOrigin("https://my.example")).toBe(false)
  })
})

describe("isAllowedRequestOrigin", () => {
  test("allows a request from the same host", () => {
    expect(isAllowedRequestOrigin("http://192.168.1.5:4096", "192.168.1.5:4096")).toBe(true)
  })

  test("falls back to the CORS allowlist for other hosts", () => {
    expect(isAllowedRequestOrigin("https://localhost", "192.168.1.5:4096")).toBe(true)
    expect(isAllowedRequestOrigin("https://evil.example", "192.168.1.5:4096")).toBe(false)
  })

  test("allows requests without an origin header", () => {
    expect(isAllowedRequestOrigin(undefined, "192.168.1.5:4096")).toBe(true)
  })
})
