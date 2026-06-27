// Identidad canónica del sitio, usada por metadata absoluta (OG, canonical),
// sitemap y robots. Override con NEXT_PUBLIC_SITE_URL si se conecta un dominio
// propio; por defecto el alias de producción en Vercel.
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://recall-mcp.vercel.app"
).replace(/\/$/, "");

export const SITE_NAME = "Recall";

// Email de soporte/contacto, visible en el footer y la página de ayuda. Override
// con NEXT_PUBLIC_SUPPORT_EMAIL si algún día se usa una casilla dedicada.
export const SUPPORT_EMAIL =
  process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? "emilycoordoba@gmail.com";

export const SITE_TAGLINE = "active recall guiado por Claude";

export const SITE_DESCRIPTION =
  "Active recall guiado por Claude: te explica un tema, vos hacés recall libre, y el sistema registra cuánto retenés con repetición espaciada.";
