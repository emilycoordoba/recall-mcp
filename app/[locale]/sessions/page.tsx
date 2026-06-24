import { getReviewSessions, getUserTimezone } from "@/lib/db"
import { currentUserId } from "@/lib/auth"
import { SessionList } from "@/components/session-list"
import { AppHeader } from "@/components/app-header"
import { BackButton } from "@/components/back-button"

export const metadata = { title: "Sesiones" }

export default async function SessionsPage() {
  const userId = await currentUserId()
  const [sessions, tz] = await Promise.all([getReviewSessions(userId), getUserTimezone(userId)])

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
        <SessionList sessions={sessions} tz={tz} />
      )}
    </div>
  )
}
