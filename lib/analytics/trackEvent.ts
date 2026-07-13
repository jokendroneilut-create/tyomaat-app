export type AnalyticsEventType = "login" | "pageview" | "project_open"

export function getDeviceType(): "mobile" | "desktop" {
  if (typeof window === "undefined") return "desktop"
  return window.innerWidth < 768 ? "mobile" : "desktop"
}

export function trackEvent(input: {
  event_type: AnalyticsEventType
  path?: string
  project_id?: string
  duration_seconds?: number
}) {
  if (typeof window === "undefined") return

  const payload = JSON.stringify({
    ...input,
    device_type: getDeviceType(),
  })

  try {
    if (navigator.sendBeacon) {
      const blob = new Blob([payload], { type: "application/json" })
      const ok = navigator.sendBeacon("/api/analytics/track", blob)
      if (ok) return
    }
  } catch {
    // sendBeacon-tuki vaihtelee, jatketaan fetch-varajärjestelmään
  }

  fetch("/api/analytics/track", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: payload,
    keepalive: true,
  }).catch(() => {
    // Analytiikan epäonnistuminen ei saa koskaan häiritä käyttäjää
  })
}
