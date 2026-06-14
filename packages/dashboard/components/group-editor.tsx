"use client"

import { useEffect, useRef, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { IconX, IconPlus } from "@tabler/icons-react"

export interface GroupRef {
  id: number
  name: string
}

// Combobox propio (sin <datalist>): input + lista filtrada de grupos existentes
// y opción "Crear «X»". Confirma SOLO con click/Enter explícito — nunca en blur,
// para que no haya carrera con otros clicks (el bug del "Volver").
export function GroupCombobox({
  allGroups,
  exclude,
  onPick,
  disabled,
}: {
  allGroups: GroupRef[]
  exclude: number[]
  onPick: (name: string) => void
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const wrapRef = useRef<HTMLDivElement>(null)

  // Cierra al hacer click fuera del panel.
  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery("")
      }
    }
    document.addEventListener("mousedown", onDown)
    return () => document.removeEventListener("mousedown", onDown)
  }, [open])

  const q = query.trim().toLowerCase()
  const candidates = allGroups
    .filter((g) => !exclude.includes(g.id))
    .filter((g) => g.name.toLowerCase().includes(q))
  const exactMatch = allGroups.some((g) => g.name.toLowerCase() === q)

  function pick(name: string) {
    const trimmed = name.trim()
    setOpen(false)
    setQuery("")
    if (trimmed) onPick(trimmed)
  }

  return (
    <div ref={wrapRef} className="relative inline-block">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-0.5 rounded border border-dashed border-muted-foreground/40 px-1.5 py-0.5 text-xs text-muted-foreground hover:border-muted-foreground/70 hover:text-foreground disabled:opacity-50"
      >
        <IconPlus className="size-3" />
        grupo
      </button>

      {open && (
        <div className="absolute left-0 top-full z-20 mt-1 w-52 rounded-md border bg-popover p-1 shadow-md">
          <input
            autoFocus
            value={query}
            placeholder="Buscar o crear…"
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                if (candidates.length === 1) pick(candidates[0].name)
                else if (q && !exactMatch) pick(query)
              }
              if (e.key === "Escape") { setOpen(false); setQuery("") }
            }}
            className="mb-1 w-full rounded border border-input bg-background px-1.5 py-1 text-xs outline-none focus:ring-2 focus:ring-ring/30"
          />
          <div className="max-h-44 overflow-y-auto">
            {candidates.map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => pick(g.name)}
                className="block w-full truncate rounded px-1.5 py-1 text-left text-xs hover:bg-accent"
              >
                {g.name}
              </button>
            ))}
            {q && !exactMatch && (
              <button
                type="button"
                onClick={() => pick(query)}
                className="block w-full truncate rounded px-1.5 py-1 text-left text-xs text-muted-foreground hover:bg-accent"
              >
                + Crear «{query.trim()}»
              </button>
            )}
            {candidates.length === 0 && !q && (
              <p className="px-1.5 py-1 text-xs text-muted-foreground">Escribí para crear un grupo…</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// Chips de grupos (presentacional): muestra los grupos con × para quitar y un
// combobox para agregar. El padre maneja estado + llamadas a la API.
export function GroupChips({
  groups,
  allGroups,
  onAdd,
  onRemove,
  busy,
}: {
  groups: GroupRef[]
  allGroups: GroupRef[]
  onAdd: (name: string) => void
  onRemove: (group: GroupRef) => void
  busy?: boolean
}) {
  return (
    <span className="flex flex-wrap items-center gap-1">
      {groups.map((g) => (
        <Badge key={g.id} variant="outline" className="gap-1 pr-1">
          {g.name}
          <button
            type="button"
            onClick={() => onRemove(g)}
            disabled={busy}
            title={`Quitar de "${g.name}"`}
            className="rounded-sm text-muted-foreground hover:text-destructive disabled:opacity-50"
          >
            <IconX className="size-3" />
          </button>
        </Badge>
      ))}
      <GroupCombobox
        allGroups={allGroups}
        exclude={groups.map((g) => g.id)}
        onPick={onAdd}
        disabled={busy}
      />
    </span>
  )
}
