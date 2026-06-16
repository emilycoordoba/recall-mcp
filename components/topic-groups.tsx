"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { GroupChips, type GroupRef } from "@/components/group-editor"

export type { GroupRef }

// Editor de grupos del topic en la página de detalle. Maneja estado optimista +
// llamadas a la API; la presentación (chips + combobox) vive en GroupChips.
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
  const [busy, setBusy] = useState(false)

  async function add(name: string) {
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
      toast.error(data.error ?? "No se pudo agregar el grupo")
      return
    }
    const { group } = (await res.json()) as { group: GroupRef }
    setGroups((gs) => (gs.some((g) => g.id === group.id) ? gs : [...gs, group].sort((a, b) => a.name.localeCompare(b.name))))
    router.refresh()
  }

  async function remove(group: GroupRef) {
    const prev = groups
    setGroups((gs) => gs.filter((g) => g.id !== group.id))
    setBusy(true)
    const res = await fetch(`/api/topics/${topicId}/groups?groupId=${group.id}`, { method: "DELETE" })
    setBusy(false)
    if (!res.ok) {
      setGroups(prev)
      const data = await res.json().catch(() => ({}))
      toast.error(data.error ?? "No se pudo quitar el grupo")
      return
    }
    router.refresh()
  }

  return (
    <div className="mt-3">
      <GroupChips groups={groups} allGroups={allGroups} onAdd={add} onRemove={remove} busy={busy} />
    </div>
  )
}
