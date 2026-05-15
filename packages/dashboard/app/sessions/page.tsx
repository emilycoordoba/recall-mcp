import Link from "next/link"
import { getReviewSessions } from "@/lib/db"
import { currentUserId } from "@/lib/auth"
import { SessionCard } from "@/components/session-card"

function formatDay(iso: string) {
  return new Date(iso).toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  })
}

export default async function SessionsPage() {
  const sessions = await getReviewSessions(await currentUserId())

  const byDay = new Map<string, typeof sessions>()
  for (const s of sessions) {
    const day = s.started_at.slice(0, 10)
    if (!byDay.has(day)) byDay.set(day, [])
    byDay.get(day)!.push(s)
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Sesiones de repaso</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {sessions.length} sesiones registradas
          </p>
        </div>
        <Link href="/" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
          ← Dashboard
        </Link>
      </div>

      {sessions.length === 0 ? (
        <p className="text-center text-muted-foreground py-20">No hay sesiones registradas.</p>
      ) : (
        <div className="space-y-8">
          {Array.from(byDay.entries()).map(([day, daySessions]) => (
            <div key={day}>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground capitalize">
                {formatDay(day)}
              </h2>
              <div className="space-y-3">
                {daySessions.map((session) => (
                  <SessionCard key={session.id} session={session} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
