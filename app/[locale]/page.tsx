import { getTranslations, setRequestLocale } from "next-intl/server"
import { Logo, LogoMark } from "@/components/logo"
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/theme-toggle"
import { Link } from "@/i18n/navigation"
import { SITE_URL, SITE_NAME, SITE_TAGLINE, SITE_DESCRIPTION } from "@/lib/site"

export const metadata = {
  title: { absolute: `${SITE_NAME} — ${SITE_TAGLINE}` },
  description: SITE_DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: { url: "/", title: `${SITE_NAME} — ${SITE_TAGLINE}`, description: SITE_DESCRIPTION },
}

export default async function LandingPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations("landing")

  // Datos estructurados para resultados enriquecidos: Recall como app web educativa.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: SITE_NAME,
    url: SITE_URL,
    description: SITE_DESCRIPTION,
    applicationCategory: "EducationalApplication",
    operatingSystem: "Web",
    inLanguage: locale,
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  }

  const steps = [
    { n: "1", title: t("step1Title"), body: t("step1Body") },
    { n: "2", title: t("step2Title"), body: t("step2Body") },
    { n: "3", title: t("step3Title"), body: t("step3Body") },
  ]

  const features = [
    { title: t("feature1Title"), body: t("feature1Body") },
    { title: t("feature2Title"), body: t("feature2Body") },
    { title: t("feature3Title"), body: t("feature3Body") },
    { title: t("feature4Title"), body: t("feature4Body") },
  ]

  return (
    <div className="min-h-screen">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
        <Logo />
        <nav className="flex items-center gap-3 text-sm">
          <Link
            href="/login"
            className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            {t("navSignIn")}
          </Link>
          <Button asChild size="sm">
            <Link href="/signup">{t("navSignUp")}</Link>
          </Button>
          <ThemeToggle />
        </nav>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        {/* Halo de marca: degradado magenta tenue detrás del título. */}
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-0 -z-10 h-72 w-72 -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(209,31,181,0.18),transparent_70%)] blur-2xl"
        />
        <div className="mx-auto max-w-3xl px-6 pb-16 pt-16 text-center sm:pt-24">
          <LogoMark className="mx-auto size-14" />
          <h1 className="mt-6 font-heading text-4xl font-semibold tracking-tight sm:text-5xl">
            {t("heroTitleLine1")}
            <br className="hidden sm:block" /> {t("heroTitleLine2")}
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-balance text-base text-muted-foreground sm:text-lg">
            {t("heroSubtitle")}
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg" className="h-10 px-5 text-sm">
              <Link href="/signup">{t("heroCtaPrimary")}</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="h-10 px-5 text-sm">
              <Link href="#como-funciona">{t("heroCtaSecondary")}</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Cómo funciona */}
      <section id="como-funciona" className="mx-auto max-w-5xl px-6 py-16 scroll-mt-8">
        <h2 className="text-center font-heading text-2xl font-semibold tracking-tight">
          {t("howItWorksTitle")}
        </h2>
        <div className="mt-10 grid gap-5 sm:grid-cols-3">
          {steps.map((s) => (
            <div key={s.n} className="rounded-xl border bg-card p-5">
              <span className="inline-flex size-8 items-center justify-center rounded-full bg-primary/10 font-heading text-sm font-semibold text-primary">
                {s.n}
              </span>
              <h3 className="mt-3 font-medium">{s.title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Por qué Recall */}
      <section className="mx-auto max-w-5xl px-6 py-12">
        <h2 className="text-center font-heading text-2xl font-semibold tracking-tight">
          {t("whyTitle")}
        </h2>
        <div className="mt-10 grid gap-5 sm:grid-cols-2">
          {features.map((f) => (
            <div key={f.title} className="rounded-xl border bg-card p-5">
              <h3 className="font-medium">{f.title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA final */}
      <section className="mx-auto max-w-3xl px-6 py-16 text-center">
        <h2 className="font-heading text-3xl font-semibold tracking-tight">
          {t("ctaTitle")}
        </h2>
        <p className="mx-auto mt-3 max-w-md text-muted-foreground">
          {t("ctaBody")}
        </p>
        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          <Button asChild size="lg" className="h-10 px-5 text-sm">
            <Link href="/signup">{t("ctaPrimary")}</Link>
          </Button>
          <Button asChild size="lg" variant="ghost" className="h-10 px-5 text-sm">
            <Link href="/login">{t("ctaSecondary")}</Link>
          </Button>
        </div>
      </section>

      <footer className="mx-auto max-w-5xl px-6 py-10 text-center flex items-center justify-center text-xs text-muted-foreground">
        <div className="pr-1"><Logo className="opacity-70" /></div>  · {t("footerTagline")}
      </footer>
    </div>
  )
}
