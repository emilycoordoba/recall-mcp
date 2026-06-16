"use client"

import { useState } from "react"
import { toast } from "sonner"
import type { UserSettings } from "@/lib/db-mcp"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

// Slot-count options offered in the UI. Must stay within REVIEW_SLOTS_MIN..MAX
// (the API clamps anyway, but keeping the UI in range avoids a silent snap-back).
const SLOT_OPTIONS = [2, 3, 4, 5, 6]

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

function Row({
  title,
  description,
  control,
}: {
  title: string
  description: string
  control: React.ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-6 p-4">
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="shrink-0">{control}</div>
    </div>
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
    <div className="divide-y rounded-lg border bg-card">
      <Row
        title="Repasar solo temas ya estrenados"
        description="Cuando está activo, los temas que nunca repasaste no entran a la sesión de repaso espaciado: se listan aparte como temas pendientes por estrenar."
        control={
          <Toggle
            checked={settings.review_only_practiced}
            disabled={saving}
            onChange={(v) => update({ review_only_practiced: v })}
          />
        }
      />

      <Row
        title="Temas por sesión de repaso"
        description="Cuántos temas trae cada sesión. Menos = sesiones más cortas (se recortan primero el recall completo y la consolidación); más = sesiones más largas."
        control={
          <Select
            value={String(settings.review_slots)}
            disabled={saving}
            onValueChange={(v) => update({ review_slots: Number(v) })}
          >
            <SelectTrigger className="w-20">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SLOT_OPTIONS.map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />

      <Row
        title="Dificultad adaptativa en vivo"
        description="Cuando está activo, el tutor sube o baja el nivel de los ejercicios dentro de la misma sesión según cómo vayas respondiendo, en vez de mantener un solo nivel. Pensado sobre todo para práctica de procedimientos (mate)."
        control={
          <Toggle
            checked={settings.adaptive_difficulty}
            disabled={saving}
            onChange={(v) => update({ adaptive_difficulty: v })}
          />
        }
      />

      <Row
        title="Ritmo de la dificultad"
        description="Qué tan rápido escala la dificultad adaptativa. Suave sube despacio y baja ante cualquier tropiezo; exigente sube rápido y tolera más antes de bajar. Solo aplica con la dificultad adaptativa activa."
        control={
          <Select
            value={settings.difficulty_pace}
            disabled={saving || !settings.adaptive_difficulty}
            onValueChange={(v) => update({ difficulty_pace: v as UserSettings["difficulty_pace"] })}
          >
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="suave">Suave</SelectItem>
              <SelectItem value="normal">Normal</SelectItem>
              <SelectItem value="exigente">Exigente</SelectItem>
            </SelectContent>
          </Select>
        }
      />
    </div>
  )
}
