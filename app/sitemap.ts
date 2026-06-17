import type { MetadataRoute } from "next"
import { SITE_URL } from "@/lib/site"

// Se sirve en /sitemap.xml. Solo rutas públicas e indexables: el landing y las
// páginas de entrada. Todo lo demás vive detrás de auth.
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()
  return [
    { url: `${SITE_URL}/`, lastModified: now, changeFrequency: "monthly", priority: 1 },
    { url: `${SITE_URL}/signup`, lastModified: now, changeFrequency: "yearly", priority: 0.5 },
    { url: `${SITE_URL}/login`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
  ]
}
