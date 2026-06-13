import { getUserSettings } from "@/lib/db-mcp"
import { currentUserId } from "@/lib/auth"
import { BackButton } from "@/components/back-button"
import { SettingsForm } from "@/components/settings-form"

export const dynamic = "force-dynamic"

export default async function SettingsPage() {
  const settings = await getUserSettings(await currentUserId())

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <BackButton />
      <h1 className="text-2xl font-semibold tracking-tight">Ajustes</h1>
      <p className="mt-1 mb-6 text-sm text-muted-foreground">
        Preferencias de tu cuenta. Aplican tanto al dashboard como a las sesiones de
        repaso desde Claude.
      </p>

      <section>
        <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Sesiones de repaso
        </h2>
        <SettingsForm initial={settings} />
      </section>
    </div>
  )
}
