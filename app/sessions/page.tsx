import { getReviewSessions, getUserTimezone } from "@/lib/db"
import { currentUserId } from "@/lib/auth"
import { SessionCard } from "@/components/session-card"
import { AppHeader } from "@/components/app-header"
import { BackButton } from "@/components/back-button"
import { dayInTz, formatDayLabel } from "@/lib/dates"

export const metadata = { title: "Sesiones" }

export default async function SessionsPage() {
  const userId = await currentUserId()
  const [sessions, tz] = await Promise.all([getReviewSessions(userId), getUserTimezone(userId)])

  // Bucket by the user's local day, not the UTC date inside started_at.
  const byDay = new Map<string, typeof sessions>()
  for (const s of sessions) {
    const day = dayInTz(s.started_at, tz)
    if (!byDay.has(day)) byDay.set(day, [])
    byDay.get(day)!.push(s)
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <AppHeader />
      <BackButton />
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Sesiones de repaso</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {sessions.length} sesiones registradas
        </p>
      </div>

      {sessions.length === 0 ? (
        <p className="text-center text-muted-foreground py-20">No hay sesiones registradas.</p>
      ) : (
        <div className="space-y-8">
          {Array.from(byDay.entries()).map(([day, daySessions]) => (
            <div key={day}>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground capitalize">
                {formatDayLabel(day)}
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
    </div>
  )
}
