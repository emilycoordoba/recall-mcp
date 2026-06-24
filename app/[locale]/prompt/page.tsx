import { getTranslations } from "next-intl/server"
import { AppHeader } from "@/components/app-header"
import { BackButton } from "@/components/back-button"
import { PromptViewer } from "@/components/prompt-viewer"
import { getPromptTemplates } from "@/lib/prompts"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: "prompt" })
  return { title: t("title") }
}

export const dynamic = "force-dynamic"

export default async function PromptPage() {
  const templates = await getPromptTemplates()
  const t = await getTranslations("prompt")

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <AppHeader />
      <BackButton />
      <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
      <p className="mt-1 mb-6 text-sm text-muted-foreground">
        {t("intro")}
      </p>

      <PromptViewer templates={templates} />
    </div>
  )
}
