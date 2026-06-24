import { getTranslations, getLocale } from "next-intl/server"
import { getHistory, getUserTimezone } from "@/lib/db"
import { currentUserId } from "@/lib/auth"
import { HistoryEntryRow } from "@/components/history-entry"
import { AppHeader } from "@/components/app-header"
import { BackButton } from "@/components/back-button"
import { dayInTz, formatDayLabel } from "@/lib/dates"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: "history" })
  return { title: t("title") }
}

export default async function HistoryPage() {
  const userId = await currentUserId()
  const [entries, tz] = await Promise.all([getHistory(userId), getUserTimezone(userId)])
  const t = await getTranslations("history")
  const locale = await getLocale()
  const dateLocale = locale === "en" ? "en-US" : "es-ES"

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
        <h1 className="text-2xl font-semibold tracking-tight">{t("heading")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("totalCount", { count: entries.length })}
        </p>
      </div>

      {entries.length === 0 ? (
        <p className="text-center text-muted-foreground py-20">{t("empty")}</p>
      ) : (
        <div className="space-y-8">
          {Array.from(byDay.entries()).map(([day, dayEntries]) => (
            <div key={day}>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground capitalize">
                {formatDayLabel(day, dateLocale)}
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
