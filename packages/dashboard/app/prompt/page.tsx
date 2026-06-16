import { AppHeader } from "@/components/app-header"
import { BackButton } from "@/components/back-button"
import { PromptViewer } from "@/components/prompt-viewer"
import { getPromptTemplates } from "@/lib/prompts"

export const metadata = { title: "System prompt" }
export const dynamic = "force-dynamic"

export default async function PromptPage() {
  const templates = await getPromptTemplates()

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <AppHeader />
      <BackButton />
      <h1 className="text-2xl font-semibold tracking-tight">System prompt</h1>
      <p className="mt-1 mb-6 text-sm text-muted-foreground">
        Copiá esto en las instrucciones de tu proyecto de Claude Desktop para que
        las sesiones de recall funcionen. Elegí la plantilla que se ajuste a cómo
        querés usar Recall.
      </p>

      <PromptViewer templates={templates} />
    </div>
  )
}
