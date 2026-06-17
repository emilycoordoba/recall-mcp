import Link from "next/link"
import { Logo, LogoMark } from "@/components/logo"
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/theme-toggle"
import { SITE_URL, SITE_NAME, SITE_TAGLINE, SITE_DESCRIPTION } from "@/lib/site"

export const metadata = {
  title: { absolute: `${SITE_NAME} — ${SITE_TAGLINE}` },
  description: SITE_DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: { url: "/", title: `${SITE_NAME} — ${SITE_TAGLINE}`, description: SITE_DESCRIPTION },
}

// Datos estructurados para resultados enriquecidos: Recall como app web educativa.
const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: SITE_NAME,
  url: SITE_URL,
  description: SITE_DESCRIPTION,
  applicationCategory: "EducationalApplication",
  operatingSystem: "Web",
  inLanguage: "es",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
}

const STEPS = [
  {
    n: "1",
    title: "Claude te explica",
    body: "En Claude Desktop, Claude explica un tema y guarda su tabla de contenido como verdad de referencia — antes de que digas una palabra.",
  },
  {
    n: "2",
    title: "Hacés recall libre",
    body: "Te pregunta «¿qué recordás?» y respondés sin pistas. El recuerdo activo es lo que fija lo aprendido en la memoria a largo plazo.",
  },
  {
    n: "3",
    title: "Seguís tu progreso",
    body: "Claude evalúa y puntúa cada subsección; el dashboard te muestra qué dominás y qué repasar, con repetición espaciada.",
  },
]

const FEATURES = [
  {
    title: "Subsecciones como verdad de referencia",
    body: "Lo explicado se guarda antes de tu recall, así la evaluación mide lo que de verdad cubriste — no la impresión del momento.",
  },
  {
    title: "Repetición espaciada (SM-2)",
    body: "El sistema calcula cuándo cada tema vuelve a tocar y arma tus sesiones de repaso por urgencia. Repasás justo antes de olvidar.",
  },
  {
    title: "Teoría y práctica",
    body: "Cada subsección es conceptual o práctica. Lo conceptual se explica; lo práctico te pone a resolver ejercicios — programación, mate, lo que sea.",
  },
  {
    title: "Por grupos, a tu ritmo",
    body: "Organizá temas en grupos (Python, Sistemas Operativos, Matemáticas…) y repasá un grupo o todo. Dificultad adaptativa opcional.",
  },
]

export default function LandingPage() {
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
            Iniciar sesión
          </Link>
          <Button asChild size="sm">
            <Link href="/signup">Crear cuenta</Link>
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
            Recordá lo que aprendés,
            <br className="hidden sm:block" /> no solo lo que leés.
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-balance text-base text-muted-foreground sm:text-lg">
            Recall convierte tus conversaciones con Claude en active recall: te explica un tema,
            te hace recordarlo de memoria y registra cuánto retenés a lo largo del tiempo.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg" className="h-10 px-5 text-sm">
              <Link href="/signup">Crear cuenta gratis</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="h-10 px-5 text-sm">
              <Link href="#como-funciona">Ver cómo funciona</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Cómo funciona */}
      <section id="como-funciona" className="mx-auto max-w-5xl px-6 py-16 scroll-mt-8">
        <h2 className="text-center font-heading text-2xl font-semibold tracking-tight">
          Cómo funciona
        </h2>
        <div className="mt-10 grid gap-5 sm:grid-cols-3">
          {STEPS.map((s) => (
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
          Por qué Recall
        </h2>
        <div className="mt-10 grid gap-5 sm:grid-cols-2">
          {FEATURES.map((f) => (
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
          Empezá a estudiar con intención
        </h2>
        <p className="mx-auto mt-3 max-w-md text-muted-foreground">
          Creá tu cuenta, conectá Claude Desktop y dejá que el sistema lleve la cuenta de tu memoria.
        </p>
        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          <Button asChild size="lg" className="h-10 px-5 text-sm">
            <Link href="/signup">Crear cuenta</Link>
          </Button>
          <Button asChild size="lg" variant="ghost" className="h-10 px-5 text-sm">
            <Link href="/login">Ya tengo cuenta</Link>
          </Button>
        </div>
      </section>

      <footer className="mx-auto max-w-5xl px-6 py-10 text-center flex items-center justify-center text-xs text-muted-foreground">
        <div className="pr-1"><Logo className="opacity-70" /></div>  · Sistema de active recall personal
      </footer>
    </div>
  )
}
