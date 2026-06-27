import type { Metadata, Viewport } from "next"
import { Geist_Mono, Nunito_Sans } from "next/font/google"
import { notFound } from "next/navigation"
import { NextIntlClientProvider, hasLocale } from "next-intl"
import { getTranslations, setRequestLocale } from "next-intl/server"

import "../globals.css"
import { routing } from "@/i18n/routing"
import { ThemeProvider } from "@/components/theme-provider"
import { ConfirmProvider } from "@/components/confirm-dialog"
import { Toaster } from "@/components/ui/sonner"
import { cn } from "@/lib/utils"
import { SITE_URL, SITE_NAME } from "@/lib/site"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: "landing" })
  const title = `${SITE_NAME} — ${t("tagline")}`
  const description = t("metaDescription")
  return {
    // Base para resolver URLs relativas de OG/canonical a absolutas.
    metadataBase: new URL(SITE_URL),
    title: { default: title, template: "%s · Recall" },
    description,
    applicationName: "Recall",
    appleWebApp: { capable: true, statusBarStyle: "default", title: "Recall" },
    keywords: [
      "active recall",
      "repetición espaciada",
      "spaced repetition",
      "SM-2",
      "estudiar",
      "memoria",
      "Claude",
      "flashcards",
    ],
    // OG/Twitter base; cada página completa título/descripción/url. La imagen sale
    // de app/opengraph-image.tsx automáticamente.
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      locale: locale === "en" ? "en_US" : "es_ES",
      title,
      description,
      url: `/${locale}`,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
    // Verificación de Google Search Console: pegá el código del meta-tag en la env
    // var GOOGLE_SITE_VERIFICATION (en Vercel) y Next emite el <meta> automáticamente.
    // Sin la var no se renderiza nada.
    verification: process.env.GOOGLE_SITE_VERIFICATION
      ? { google: process.env.GOOGLE_SITE_VERIFICATION }
      : undefined,
  }
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
}

const nunitoSans = Nunito_Sans({ subsets: ["latin"], variable: "--font-sans" })

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
})

// Prerrenderiza ambos idiomas en build en vez de resolverlos por request.
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }))
}

export default async function LocaleLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode
  params: Promise<{ locale: string }>
}>) {
  const { locale } = await params
  // Locale no soportado (p.ej. /fr/...) → 404 en vez de romper.
  if (!hasLocale(routing.locales, locale)) notFound()
  // Habilita render estático: fija el locale antes de leer traducciones.
  setRequestLocale(locale)

  return (
    <html
      lang={locale}
      suppressHydrationWarning
      className={cn("antialiased", fontMono.variable, "font-sans", nunitoSans.variable)}
    >
      <body>
        <NextIntlClientProvider>
          <ThemeProvider>
            <ConfirmProvider>{children}</ConfirmProvider>
            <Toaster />
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
