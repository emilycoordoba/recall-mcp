import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { USER_HEADER } from "./auth-constants";

// Rutas que NO requieren sesión de dashboard (el MCP/OAuth tienen su propia auth
// por token; login/signup son las páginas de entrada).
const PUBLIC_PREFIXES = ["/login", "/signup", "/auth"];

function isPublic(pathname: string) {
  return PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

// Refresca la sesión de Supabase Auth y resuelve el usuario. Si hay sesión,
// propaga el users.id (int, leído de app_metadata) por el header USER_HEADER para
// que `currentUserId()` lo use. Si no hay sesión y la ruta no es pública, redirige
// a /login. Patrón estándar de @supabase/ssr para middleware (Edge).
export async function updateSession(req: NextRequest): Promise<NextResponse> {
  let res = NextResponse.next({ request: req });

  const supabase = createServerClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => req.cookies.set(name, value));
          res = NextResponse.next({ request: req });
          cookiesToSet.forEach(({ name, value, options }) =>
            res.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // getUser() revalida el token contra el auth server (no confiar en getSession()).
  const { data: { user } } = await supabase.auth.getUser();
  const { pathname } = req.nextUrl;

  if (!user) {
    if (isPublic(pathname)) return res;
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // Ya autenticado entrando a /login → mándalo al dashboard.
  if (pathname === "/login" || pathname === "/signup") {
    const url = req.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  const appUserId = user.app_metadata?.app_user_id;
  if (appUserId != null) {
    const headers = new Headers(req.headers);
    headers.set(USER_HEADER, String(appUserId));
    const passthrough = NextResponse.next({ request: { headers } });
    // Conserva las cookies de refresco que pudo setear getUser().
    res.cookies.getAll().forEach((c) => passthrough.cookies.set(c));
    return passthrough;
  }

  return res;
}
