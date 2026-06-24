import { getTranslations, setRequestLocale } from "next-intl/server";
import { signup } from "./actions";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "auth" });
  return { title: t("signupTitle") };
}

export default async function SignupPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { error } = await searchParams;
  const t = await getTranslations("auth");

  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-sm rounded-xl border bg-card p-6 shadow-sm">
        <h1 className="text-lg font-semibold tracking-tight">{t("signupTitle")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("signupSubtitle")}</p>

        {error && (
          <p className="mt-4 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        <form action={signup} className="mt-5 space-y-3">
          <div className="space-y-1">
            <label htmlFor="name" className="text-xs font-medium text-muted-foreground">{t("name")}</label>
            <input
              id="name"
              name="name"
              type="text"
              required
              autoFocus
              autoComplete="name"
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="email" className="text-xs font-medium text-muted-foreground">{t("email")}</label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="password" className="text-xs font-medium text-muted-foreground">{t("password")}</label>
            <input
              id="password"
              name="password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
            />
            <p className="text-xs text-muted-foreground">{t("min8")}</p>
          </div>
          <Button type="submit" className="w-full">{t("signupSubmit")}</Button>
        </form>

        <p className="mt-4 text-center text-sm text-muted-foreground">
          {t("haveAccount")}{" "}
          <Link href="/login" className="underline underline-offset-4 hover:text-foreground">
            {t("loginLink")}
          </Link>
        </p>
      </div>
    </div>
  );
}
