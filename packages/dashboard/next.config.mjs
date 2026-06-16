import path from "path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {
    root: path.resolve(__dirname, "../.."),
  },
  // La página /prompt lee los .md de system prompt con fs en runtime. Next solo
  // empaqueta archivos que detecta por import, así que hay que incluirlos a mano
  // para que no falten en la función de Vercel (ENOENT en producción).
  outputFileTracingIncludes: {
    "/prompt": ["./SYSTEM_PROMPT.md", "./SYSTEM_PROMPT_MATE.md"],
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

export default nextConfig;
