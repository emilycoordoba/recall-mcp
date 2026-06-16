"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

// Reports the browser's IANA timezone to the server so day-bucketing (streak,
// SM-2, day headers) matches where the user actually is. Renders nothing.
//
// WHY a client effect: the server process runs in UTC and has no way to know the
// viewer's zone; only the browser does (Intl...resolvedOptions().timeZone). We
// persist it once (and again only if it changes, e.g. the user travels), then
// refresh so server-rendered dates re-compute with the corrected zone.
export function TimezoneSync({ stored }: { stored: string }) {
  const router = useRouter()

  useEffect(() => {
    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone
    if (!detected || detected === stored) return

    fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ timezone: detected }),
    })
      .then((res) => {
        if (res.ok) router.refresh()
      })
      .catch(() => {
        // Best-effort: a failed sync just leaves the previous zone in place.
      })
  }, [stored, router])

  return null
}
