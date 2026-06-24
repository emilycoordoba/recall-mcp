import { defineRouting } from "next-intl/routing";

// Configuración central de i18n: lista de locales soportados y default.
// La importan el middleware (i18n routing), las APIs de navegación
// (i18n/navigation.ts) y la carga de mensajes (i18n/request.ts), para que no
// haya listas de idiomas duplicadas que se desincronicen.
//
// `localePrefix: "always"` => el default también lleva prefijo (/es/...), lo que
// mantiene URLs canónicas estables y hreflang simétrico para SEO.
export const routing = defineRouting({
  locales: ["es", "en"],
  defaultLocale: "es",
  localePrefix: "always",
});

export type Locale = (typeof routing.locales)[number];
