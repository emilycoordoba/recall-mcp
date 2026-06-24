import { useTranslations } from "next-intl"
import { Badge } from "@/components/ui/badge"

// Nivel de dificultad (1-5) para práctica procedimental (mate). Tono violeta a
// propósito: la dificultad no es "bueno/malo" como el score (verde/amarillo/rojo),
// es solo el nivel al que se está practicando.
export function DifficultyBadge({
  level,
  title,
  className,
}: {
  level: number
  title?: string
  className?: string
}) {
  const t = useTranslations("badges")
  return (
    <Badge
      variant="outline"
      title={title ?? t("difficultyTitle", { level })}
      className={`border-violet-500/30 bg-violet-500/10 font-normal text-violet-700 dark:text-violet-300 ${className ?? ""}`}
    >
      {t("difficultyShort", { level })}
    </Badge>
  )
}
