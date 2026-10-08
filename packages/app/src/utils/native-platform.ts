export function isNativeShell(target: unknown = globalThis): boolean {
  const capacitor = (target as { Capacitor?: { isNativePlatform?: () => boolean } } | undefined)?.Capacitor
  if (!capacitor || typeof capacitor.isNativePlatform !== "function") return false
  try {
    return capacitor.isNativePlatform() === true
  } catch {
    return false
  }
}
