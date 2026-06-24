import { useTranslations } from "next-intl"
import type { TopicKind } from "@/lib/topic-kind"

// Mismo lenguaje cromático que el chip por subsección (sky=teoría, violet=práctica);
// el mixto combina ambos en un degradado tenue.
const STYLES: Record<TopicKind, string> = {
  teorico: "bg-sky-500/15 text-sky-600 dark:text-sky-300",
  practico: "bg-violet-500/15 text-violet-600 dark:text-violet-300",
  teorico_practico:
    "bg-gradient-to-r from-sky-500/15 to-violet-500/15 text-foreground/70",
}

export function TopicKindBadge({ kind, className = "" }: { kind: TopicKind; className?: string }) {
  const t = useTranslations("topicKind")
  const label = t(kind)
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium leading-none ${STYLES[kind]} ${className}`}
      title={t("badgeTitle", { label })}
    >
      {label}
    </span>
  )
}
