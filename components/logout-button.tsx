import { getTranslations } from "next-intl/server";

// Botón de cerrar sesión: un form que postea al route handler /auth/signout.
// Server Component (no necesita estado) — el POST limpia las cookies de sesión
// y redirige a /login. Estilado como los demás links de la nav.
export async function LogoutButton() {
  const t = await getTranslations("nav");
  return (
    <form action="/auth/signout" method="post">
      <button
        type="submit"
        className="text-sm text-muted-foreground underline-offset-4 hover:underline"
      >
        {t("logout")}
      </button>
    </form>
  );
}
