import type { MetadataRoute } from "next"
import { SITE_URL } from "@/lib/site"

// Se sirve en /robots.txt. Permite el landing y las páginas de entrada; bloquea
// todo lo que está detrás de auth (dashboard y sus rutas) y los endpoints de API
// — no aportan a la indexación y solo redirigen a /login para un crawler.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/app",
        "/topics/",
        "/settings",
        "/sessions",
        "/history",
        "/prompt",
        "/authorize",
        "/auth/",
        "/api/",
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  }
}
