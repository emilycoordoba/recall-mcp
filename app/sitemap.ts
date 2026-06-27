import type { MetadataRoute } from "next"
import { SITE_URL } from "@/lib/site"
import { routing } from "@/i18n/routing"

// Rutas públicas e indexables (sin el prefijo de locale). Todo lo demás vive
// detrás de auth. Cada ruta se emite por cada locale con sus alternates hreflang.
const PATHS = [
  { path: "", changeFrequency: "monthly" as const, priority: 1 },
  { path: "/signup", changeFrequency: "yearly" as const, priority: 0.5 },
  { path: "/login", changeFrequency: "yearly" as const, priority: 0.3 },
]

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()
  return PATHS.flatMap(({ path, changeFrequency, priority }) =>
    routing.locales.map((locale) => ({
      url: `${SITE_URL}/${locale}${path}`,
      lastModified: now,
      changeFrequency,
      priority,
      alternates: {
        languages: Object.fromEntries(
          routing.locales.map((l) => [l, `${SITE_URL}/${l}${path}`]),
        ),
      },
    })),
  )
}
