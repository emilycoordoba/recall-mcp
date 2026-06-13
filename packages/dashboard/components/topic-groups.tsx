"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { IconX, IconPlus } from "@tabler/icons-react"

export interface GroupRef {
  id: number
  name: string
}

// Edición de los grupos de un topic (muchos-a-muchos). Chips con × para quitar y
// un control "+ grupo" con autocompletado de grupos existentes (o crear uno nuevo).
// Optimista con rollback; se sincroniza con el servidor vía router.refresh().
export function TopicGroups({
  topicId,
  initialGroups,
  allGroups,
}: {
  topicId: number
  initialGroups: GroupRef[]
  allGroups: GroupRef[]
}) {
  const router = useRouter()
  const [groups, setGroups] = useState<GroupRef[]>(initialGroups)
  const [adding, setAdding] = useState(false)
  const [value, setValue] = useState("")
  const [busy, setBusy] = useState(false)
  const listId = `groups-${topicId}`

  // Sugerencias: grupos existentes que el topic aún no tiene.
  const suggestions = allGroups.filter((g) => !groups.some((x) => x.id === g.id))

  async function addGroup() {
    const name = value.trim()
    setValue("")
    setAdding(false)
    if (!name) return
    if (groups.some((g) => g.name.toLowerCase() === name.toLowerCase())) return

    setBusy(true)
    const res = await fetch(`/api/topics/${topicId}/groups`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    })
    setBusy(false)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      alert(data.error ?? "No se pudo agregar el grupo")
      return
    }
    const { group } = (await res.json()) as { group: GroupRef }
    setGroups((gs) => (gs.some((g) => g.id === group.id) ? gs : [...gs, group].sort((a, b) => a.name.localeCompare(b.name))))
    router.refresh()
  }

  async function removeGroup(group: GroupRef) {
    const prev = groups
    setGroups((gs) => gs.filter((g) => g.id !== group.id))
    setBusy(true)
    const res = await fetch(`/api/topics/${topicId}/groups?groupId=${group.id}`, { method: "DELETE" })
    setBusy(false)
    if (!res.ok) {
      setGroups(prev)
      const data = await res.json().catch(() => ({}))
      alert(data.error ?? "No se pudo quitar el grupo")
      return
    }
    router.refresh()
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-1.5">
      {groups.map((g) => (
        <Badge key={g.id} variant="outline" className="gap-1 pr-1">
          {g.name}
          <button
            onClick={() => removeGroup(g)}
            disabled={busy}
            title={`Quitar de "${g.name}"`}
            className="rounded-sm text-muted-foreground hover:text-destructive disabled:opacity-50"
          >
            <IconX className="size-3" />
          </button>
        </Badge>
      ))}

      {adding ? (
        <>
          <input
            autoFocus
            list={listId}
            value={value}
            disabled={busy}
            placeholder="Grupo…"
            onChange={(e) => setValue(e.target.value)}
            onBlur={addGroup}
            onKeyDown={(e) => {
              if (e.key === "Enter") addGroup()
              if (e.key === "Escape") { setValue(""); setAdding(false) }
            }}
            className="h-6 w-32 rounded border border-ring bg-background px-1.5 text-xs outline-none focus:ring-2 focus:ring-ring/30 disabled:opacity-50"
          />
          <datalist id={listId}>
            {suggestions.map((g) => (
              <option key={g.id} value={g.name} />
            ))}
          </datalist>
        </>
      ) : (
        <button
          onClick={() => setAdding(true)}
          disabled={busy}
          className="inline-flex items-center gap-0.5 rounded border border-dashed border-muted-foreground/40 px-1.5 py-0.5 text-xs text-muted-foreground hover:border-muted-foreground/70 hover:text-foreground disabled:opacity-50"
        >
          <IconPlus className="size-3" />
          grupo
        </button>
      )}
    </div>
  )
}
