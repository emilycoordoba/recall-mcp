"use client"

import { useState } from "react"
import { toast } from "sonner"
import type { UserSettings } from "@/lib/db-mcp"

function Toggle({
  checked,
  disabled,
  onChange,
}: {
  checked: boolean
  disabled?: boolean
  onChange: (next: boolean) => void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:opacity-50 ${
        checked ? "bg-primary" : "bg-input"
      }`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-background shadow transition-transform ${
          checked ? "translate-x-5" : "translate-x-0.5"
        }`}
      />
    </button>
  )
}

export function SettingsForm({ initial }: { initial: UserSettings }) {
  const [settings, setSettings] = useState(initial)
  const [saving, setSaving] = useState(false)

  async function update(patch: Partial<UserSettings>) {
    const prev = settings
    setSettings((s) => ({ ...s, ...patch })) // optimistic
    setSaving(true)
    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    })
    setSaving(false)
    if (!res.ok) {
      setSettings(prev) // rollback
      const data = await res.json().catch(() => ({}))
      toast.error(data.error ?? "No se pudo guardar")
    } else {
      toast.success("Ajustes guardados")
    }
  }

  return (
    <div className="rounded-lg border bg-card">
      <div className="flex items-start justify-between gap-6 p-4">
        <div>
          <p className="text-sm font-medium">Repasar solo temas ya estrenados</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Cuando está activo, los temas que nunca repasaste no entran a la sesión de
            repaso espaciado: se listan aparte como temas pendientes por estrenar.
          </p>
        </div>
        <Toggle
          checked={settings.review_only_practiced}
          disabled={saving}
          onChange={(v) => update({ review_only_practiced: v })}
        />
      </div>
    </div>
  )
}
