import { ImageResponse } from "next/og"
import { SITE_NAME, SITE_TAGLINE } from "@/lib/site"

// Imagen Open Graph generada en build/edge (1200×630). Se inyecta como og:image
// y twitter:image en todas las páginas. Lenguaje de marca: fondo oscuro, magenta
// de Recall en degradado.
export const alt = `${SITE_NAME} — ${SITE_TAGLINE}`
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

const MAGENTA = "#D11FB5"
const PURPLE = "#8A1C84"

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#0a0a0a",
          backgroundImage: `radial-gradient(circle at 50% 38%, rgba(209,31,181,0.22), transparent 55%)`,
          fontFamily: "sans-serif",
        }}
      >
        {/* Marca: bucle de recall */}
        <svg width="132" height="132" viewBox="0 0 64 64" fill="none">
          <defs>
            <linearGradient id="g" x1="16" y1="10" x2="48" y2="54" gradientUnits="userSpaceOnUse">
              <stop stopColor={MAGENTA} />
              <stop offset="1" stopColor={PURPLE} />
            </linearGradient>
          </defs>
          <path d="M41 16.41 A18 18 0 1 1 23 16.41" stroke="url(#g)" strokeWidth="6" strokeLinecap="round" />
          <path d="M30.79 11.91 L24.7 22.36 L18.7 11.96 Z" fill="url(#g)" />
          <circle cx="32" cy="32" r="5.5" fill="url(#g)" />
        </svg>

        <div
          style={{
            marginTop: 28,
            fontSize: 116,
            fontWeight: 800,
            letterSpacing: "-0.03em",
            backgroundImage: `linear-gradient(135deg, ${MAGENTA}, ${PURPLE})`,
            backgroundClip: "text",
            WebkitBackgroundClip: "text",
            color: "transparent",
          }}
        >
          {SITE_NAME}
        </div>

        <div
          style={{
            marginTop: 8,
            maxWidth: 820,
            textAlign: "center",
            fontSize: 40,
            lineHeight: 1.25,
            color: "#e8e8ea",
          }}
        >
          Recordá lo que aprendés, no solo lo que leés.
        </div>

        <div style={{ marginTop: 26, fontSize: 26, color: "#9b9ba3" }}>
          {SITE_TAGLINE}
        </div>
      </div>
    ),
    { ...size },
  )
}
