"use client"

import { useState } from "react"
import { useTranslations, useLocale } from "next-intl"
import { SessionCard } from "@/components/session-card"
import type { ReviewSessionEntry } from "@/lib/db"
import { dayInTz, formatDayLabel } from "@/lib/dates"

// A session is "empty" when none of its slots links to a saved record (no scores).
// These are usually plan requests that never became real practice — noise in the
// list. The real work always lives in each topic's history regardless, so hiding
// them here loses nothing.
const isEmpty = (s: ReviewSessionEntry) => s.slots.every((slot) => slot.score === null)

export function SessionList({ sessions, tz }: { sessions: ReviewSessionEntry[]; tz: string }) {
  const t = useTranslations("sessions")
  const locale = useLocale()
  const dateLocale = locale === "en" ? "en-US" : "es-ES"
  const [showEmpty, setShowEmpty] = useState(false)

  const emptyCount = sessions.filter(isEmpty).length
  const visible = showEmpty ? sessions : sessions.filter((s) => !isEmpty(s))

  // Bucket by the user's local day, not the UTC date inside started_at.
  const byDay = new Map<string, ReviewSessionEntry[]>()
  for (const s of visible) {
    const day = dayInTz(s.started_at, tz)
    if (!byDay.has(day)) byDay.set(day, [])
    byDay.get(day)!.push(s)
  }

  return (
    <>
      {emptyCount > 0 && (
        <div className="mb-4 flex items-center gap-2 text-xs text-muted-foreground">
          <span>
            {showEmpty
              ? t("emptyShownCount", { count: emptyCount })
              : t("emptyHiddenCount", { count: emptyCount })}
          </span>
          <button
            onClick={() => setShowEmpty((v) => !v)}
            className="underline underline-offset-4 hover:text-foreground"
          >
            {showEmpty ? t("hide") : t("show")}
          </button>
        </div>
      )}

      {visible.length === 0 ? (
        <p className="text-center text-muted-foreground py-20">{t("emptyVisible")}</p>
      ) : (
        <div className="space-y-8">
          {Array.from(byDay.entries()).map(([day, daySessions]) => (
            <div key={day}>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground capitalize">
                {formatDayLabel(day, dateLocale)}
              </h2>
              <div className="space-y-3">
                {daySessions.map((session) => (
                  <SessionCard key={session.id} session={session} tz={tz} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  )
}
