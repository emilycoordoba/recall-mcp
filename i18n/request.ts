import { getRequestConfig } from "next-intl/server";
import { hasLocale } from "next-intl";
import { routing } from "./routing";

// Config por-request en el servidor: next-intl entrega el locale resuelto de la
// URL y acá devolvemos el catálogo de mensajes correspondiente. Si el locale no
// es uno de los soportados (p.ej. /fr/...), caemos al default — defensa contra
// URLs de idiomas que no tenemos.
export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
