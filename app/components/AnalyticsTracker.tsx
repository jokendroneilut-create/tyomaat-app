"use client"

import { useEffect, useRef } from "react"
import { usePathname } from "next/navigation"
import { trackEvent } from "@/lib/analytics/trackEvent"

const PERIODIC_FLUSH_MS = 60_000

export default function AnalyticsTracker() {
  const pathname = usePathname()
  const pathRef = useRef(pathname)
  const startRef = useRef<number>(Date.now())
  const accumulatedMsRef = useRef(0)

  function visibleMs() {
    if (document.visibilityState === "visible") {
      return accumulatedMsRef.current + (Date.now() - startRef.current)
    }
    return accumulatedMsRef.current
  }

  function flush(path: string, resetAfter: boolean) {
    const seconds = Math.round(visibleMs() / 1000)

    if (seconds > 0) {
      trackEvent({ event_type: "pageview", path, duration_seconds: seconds })
    }

    if (resetAfter) {
      accumulatedMsRef.current = 0
      startRef.current = Date.now()
    }
  }

  useEffect(() => {
    const previousPath = pathRef.current

    if (previousPath && previousPath !== pathname) {
      flush(previousPath, true)
    }

    pathRef.current = pathname
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  useEffect(() => {
    function handleVisibilityChange() {
      if (document.visibilityState === "hidden") {
        accumulatedMsRef.current += Date.now() - startRef.current
      } else {
        startRef.current = Date.now()
      }
    }

    function handleUnload() {
      flush(pathRef.current, false)
    }

    const interval = setInterval(() => {
      flush(pathRef.current, true)
    }, PERIODIC_FLUSH_MS)

    document.addEventListener("visibilitychange", handleVisibilityChange)
    window.addEventListener("pagehide", handleUnload)
    window.addEventListener("beforeunload", handleUnload)

    return () => {
      clearInterval(interval)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      window.removeEventListener("pagehide", handleUnload)
      window.removeEventListener("beforeunload", handleUnload)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return null
}
