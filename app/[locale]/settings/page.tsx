import { getTranslations } from "next-intl/server"
import { getUserSettings } from "@/lib/db-mcp"
import { currentUserId } from "@/lib/auth"
import { AppHeader } from "@/components/app-header"
import { BackButton } from "@/components/back-button"
import { SettingsForm } from "@/components/settings-form"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: "settings" })
  return { title: t("title") }
}

export const dynamic = "force-dynamic"

export default async function SettingsPage() {
  const settings = await getUserSettings(await currentUserId())
  const t = await getTranslations("settings")

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <AppHeader />
      <BackButton />
      <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
      <p className="mt-1 mb-6 text-sm text-muted-foreground">
        {t("intro")}
      </p>

      <section>
        <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {t("sectionReview")}
        </h2>
        <SettingsForm initial={settings} />
      </section>
    </div>
  )
}
