type HapticsPlugin = {
  impact?: (input: { style: string }) => unknown
  notification?: (input: { type: string }) => unknown
}

function plugin(target: unknown): HapticsPlugin | undefined {
  return (target as { Capacitor?: { Plugins?: { Haptics?: HapticsPlugin } } })?.Capacitor?.Plugins?.Haptics
}

export function hapticImpact(style: "light" | "medium" | "heavy", target: unknown = globalThis): boolean {
  const haptics = plugin(target)
  if (typeof haptics?.impact !== "function") return false
  try {
    haptics.impact({ style: style.toUpperCase() })
    return true
  } catch {
    return false
  }
}

export function hapticNotification(type: "success" | "warning" | "error", target: unknown = globalThis): boolean {
  const haptics = plugin(target)
  if (typeof haptics?.notification !== "function") return false
  try {
    haptics.notification({ type: type.toUpperCase() })
    return true
  } catch {
    return false
  }
}
