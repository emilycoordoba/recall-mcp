import type { MetadataRoute } from "next"

// Web App Manifest (served at /manifest.webmanifest). Hace la app instalable en
// el teléfono: icono en la pantalla de inicio, splash y ventana sin barra del
// navegador. No habilita uso offline (eso requeriría un service worker).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Recall",
    short_name: "Recall",
    description: "Sistema de active recall personal — repasá temas y seguí tu progreso.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    lang: "es",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  }
}
