import type { CapacitorConfig } from "@capacitor/cli"

// Android WebView origin is http://localhost so API calls to the LAN server are
// plain http-to-http requests, not mixed content. cleartext permits the LAN
// fetch; allowMixedContent is a safety net for redirects to https.
const config: CapacitorConfig = {
  appId: "ai.opencode.mobile",
  appName: "opencode",
  webDir: "www",
  server: {
    androidScheme: "http",
    cleartext: true,
  },
  android: {
    allowMixedContent: true,
  },
}

export default config
