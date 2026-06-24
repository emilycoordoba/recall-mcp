"use client"

import * as React from "react"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import { IconCopy } from "@tabler/icons-react"

import type { LoadedPromptTemplate } from "@/lib/prompts"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

// Muestra el system prompt elegido y deja copiarlo. Las plantillas llegan ya
// leídas desde el Server Component (lib/prompts.ts); este island solo maneja la
// selección y el copy.
export function PromptViewer({ templates }: { templates: LoadedPromptTemplate[] }) {
  const t = useTranslations("prompt")
  const [selectedId, setSelectedId] = React.useState(templates[0]?.id)
  const selected = templates.find((t) => t.id === selectedId) ?? templates[0]

  // `navigator.clipboard` solo existe en contextos seguros (HTTPS/localhost); en
  // la IP LAN sobre HTTP es `undefined`. Chequeamos antes de usarla y, si no está
  // o falla, avisamos para copiar a mano en vez de romper en silencio.
  async function handleCopy() {
    if (!navigator.clipboard?.writeText) {
      toast.error(t("clipboardBlocked"))
      return
    }
    try {
      await navigator.clipboard.writeText(selected.content)
      toast.success(t("copied", { label: selected.label }))
    } catch {
      toast.error(t("copyError"))
    }
  }

  if (!selected) {
    return <p className="text-sm text-muted-foreground">{t("noTemplates")}</p>
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {templates.map((template) => {
          const active = template.id === selected.id
          return (
            <button
              key={template.id}
              type="button"
              onClick={() => setSelectedId(template.id)}
              aria-pressed={active}
              className={cn(
                "rounded-md border px-3 py-1.5 text-sm transition-colors",
                active
                  ? "border-primary bg-primary/10 text-foreground"
                  : "border-border text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {template.label}
            </button>
          )
        })}
      </div>

      <p className="text-sm text-muted-foreground">{selected.description}</p>

      <div className="relative">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={handleCopy}
          className="absolute right-3 top-3"
        >
          <IconCopy />
          {t("copy")}
        </Button>
        <pre className="max-h-[28rem] overflow-auto rounded-lg border border-border bg-muted/40 p-4 pt-12 text-xs leading-relaxed whitespace-pre-wrap">
          {selected.content}
        </pre>
      </div>
    </div>
  )
}
