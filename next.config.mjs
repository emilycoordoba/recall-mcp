import createNextIntlPlugin from "next-intl/plugin";

// El plugin de next-intl conecta i18n/request.ts al build y habilita los mensajes
// en Server Components. Por defecto busca ./i18n/request.ts.
const withNextIntl = createNextIntlPlugin();

/** @type {import('next').NextConfig} */
const nextConfig = {
  // La página /prompt lee los .md de system prompt con fs en runtime. Next solo
  // empaqueta archivos que detecta por import, así que hay que incluirlos a mano
  // para que no falten en la función de Vercel (ENOENT en producción). Con i18n
  // la ruta queda bajo el segmento de locale.
  outputFileTracingIncludes: {
    "/[locale]/prompt": ["./SYSTEM_PROMPT.md", "./SYSTEM_PROMPT_MATE.md"],
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  async rewrites() {
    return [
      {
        source: "/.well-known/oauth-authorization-server",
        destination: "/api/oauth/discovery",
      },
      {
        source: "/.well-known/oauth-protected-resource",
        destination: "/api/oauth/protected-resource",
      },
      // Claude.ai calls /token (without prefix) when discovery fails
      {
        source: "/token",
        destination: "/api/oauth/token",
      },
    ];
  },
};

export default withNextIntl(nextConfig);
