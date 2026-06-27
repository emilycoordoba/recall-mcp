import type { Metadata } from "next"
import { getTranslations, setRequestLocale } from "next-intl/server"
import { Logo } from "@/components/logo"
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/theme-toggle"
import { LanguageToggle } from "@/components/language-toggle"
import { Link } from "@/i18n/navigation"
import { SUPPORT_EMAIL } from "@/lib/site"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: "help" })
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    alternates: {
      canonical: `/${locale}/ayuda`,
      languages: { es: "/es/ayuda", en: "/en/ayuda", "x-default": "/es/ayuda" },
    },
    openGraph: {
      type: "article",
      locale: locale === "en" ? "en_US" : "es_ES",
      url: `/${locale}/ayuda`,
      title: t("metaTitle"),
      description: t("metaDescription"),
    },
  }
}

export default async function HelpPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations("help")

  // FAQ: 6 pares pregunta/respuesta en el namespace `help` (q1..q6 / a1..a6).
  const faqs = [1, 2, 3, 4, 5, 6].map((n) => ({
    q: t(`q${n}`),
    a: t(`a${n}`),
  }))

  // Datos estructurados FAQPage para resultados enriquecidos en Google.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    inLanguage: locale,
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  }

  return (
    <div className="min-h-screen">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <header className="mx-auto flex max-w-3xl items-center justify-between px-6 py-5">
        <Link href="/" aria-label={t("backToHome")}>
          <Logo />
        </Link>
        <nav className="flex items-center gap-3 text-sm">
          <LanguageToggle />
          <ThemeToggle />
        </nav>
      </header>

      <main className="mx-auto max-w-3xl px-6 pb-20 pt-8">
        <h1 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
          {t("title")}
        </h1>
        <p className="mt-3 max-w-xl text-muted-foreground">{t("intro")}</p>

        <dl className="mt-10 space-y-8">
          {faqs.map((f, i) => (
            <div key={i} className="rounded-xl border bg-card p-5">
              <dt className="font-medium">{f.q}</dt>
              <dd className="mt-2 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                {f.a}
              </dd>
            </div>
          ))}
        </dl>

        {/* Contacto */}
        <section className="mt-12 rounded-xl border bg-card p-6 text-center">
          <h2 className="font-heading text-xl font-semibold tracking-tight">
            {t("contactTitle")}
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            {t("contactBody")}
          </p>
          <Button asChild className="mt-5">
            <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
          </Button>
        </section>

        <p className="mt-10 text-center text-sm">
          <Link
            href="/"
            className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            ← {t("backToHome")}
          </Link>
        </p>
      </main>
    </div>
  )
}
