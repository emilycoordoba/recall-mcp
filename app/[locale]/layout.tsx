import type { Metadata, Viewport } from "next"
import { Geist_Mono, Nunito_Sans } from "next/font/google"
import { notFound } from "next/navigation"
import { NextIntlClientProvider, hasLocale } from "next-intl"
import { setRequestLocale } from "next-intl/server"

import "../globals.css"
import { routing } from "@/i18n/routing"
import { ThemeProvider } from "@/components/theme-provider"
import { ConfirmProvider } from "@/components/confirm-dialog"
import { Toaster } from "@/components/ui/sonner"
import { cn } from "@/lib/utils"
import { SITE_URL, SITE_NAME, SITE_DESCRIPTION, SITE_TAGLINE } from "@/lib/site"

export const metadata: Metadata = {
  // Base para resolver URLs relativas de OG/canonical a absolutas.
  metadataBase: new URL(SITE_URL),
  title: { default: `${SITE_NAME} — ${SITE_TAGLINE}`, template: "%s · Recall" },
  description: SITE_DESCRIPTION,
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
    locale: "es_ES",
    title: `${SITE_NAME} — ${SITE_TAGLINE}`,
    description: SITE_DESCRIPTION,
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} — ${SITE_TAGLINE}`,
    description: SITE_DESCRIPTION,
  },
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
