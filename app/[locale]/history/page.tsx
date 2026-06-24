import { getHistory, getUserTimezone } from "@/lib/db"
import { currentUserId } from "@/lib/auth"
import { HistoryEntryRow } from "@/components/history-entry"
import { AppHeader } from "@/components/app-header"
import { BackButton } from "@/components/back-button"
import { dayInTz, formatDayLabel } from "@/lib/dates"

export const metadata = { title: "Historial" }

export default async function HistoryPage() {
  const userId = await currentUserId()
  const [entries, tz] = await Promise.all([getHistory(userId), getUserTimezone(userId)])

  // Bucket by the user's local day, not the UTC date inside the timestamp: a
  // late-evening session would otherwise land under the next day's header.
  const byDay = new Map<string, typeof entries>()
  for (const entry of entries) {
    const day = dayInTz(entry.date, tz)
    if (!byDay.has(day)) byDay.set(day, [])
    byDay.get(day)!.push(entry)
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <AppHeader />
      <BackButton />
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Historial</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {entries.length} sesiones en total
        </p>
      </div>

      {entries.length === 0 ? (
        <p className="text-center text-muted-foreground py-20">No hay sesiones registradas.</p>
      ) : (
        <div className="space-y-8">
          {Array.from(byDay.entries()).map(([day, dayEntries]) => (
            <div key={day}>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground capitalize">
                {formatDayLabel(day)}
              </h2>
              <div className="overflow-hidden rounded-lg ring-1 ring-border divide-y divide-border">
                {dayEntries.map((entry) => (
                  <HistoryEntryRow key={`${entry.type}-${entry.id}`} entry={entry} tz={tz} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
