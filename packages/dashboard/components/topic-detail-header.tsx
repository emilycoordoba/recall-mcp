"use client"

import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { IconTrash } from "@tabler/icons-react"

interface Topic {
  id: number
  name: string
  description: string | null
  group_name: string | null
}

export function TopicDetailHeader({
  topic,
  recallCount,
  quickReviewCount,
}: {
  topic: Topic
  recallCount: number
  quickReviewCount: number
}) {
  const router = useRouter()
  const [name, setName] = useState(topic.name)
  const [description, setDescription] = useState(topic.description ?? "")
  const [editingName, setEditingName] = useState(false)
  const [editingDesc, setEditingDesc] = useState(false)
  const [busy, setBusy] = useState(false)
  const nameRef = useRef<HTMLInputElement>(null)

  async function patch(body: Record<string, unknown>, onError: () => void) {
    setBusy(true)
    const res = await fetch(`/api/topics/${topic.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    setBusy(false)
    if (!res.ok) {
      onError()
      const data = await res.json().catch(() => ({}))
      alert(data.error ?? "No se pudo guardar")
    } else {
      router.refresh()
    }
  }

  async function commitName() {
    const trimmed = name.trim()
    setEditingName(false)
    if (!trimmed || trimmed === topic.name) { setName(topic.name); return }
    await patch({ name: trimmed }, () => setName(topic.name))
  }

  async function commitDesc() {
    const trimmed = description.trim()
    setEditingDesc(false)
    if (trimmed === (topic.description ?? "")) return
    await patch({ description: trimmed || null }, () => setDescription(topic.description ?? ""))
  }

  async function remove() {
    if (!confirm(`¿Borrar el topic "${topic.name}" y todo su historial? Esta acción no se puede deshacer.`)) return
    setBusy(true)
    const res = await fetch(`/api/topics/${topic.id}`, { method: "DELETE" })
    if (!res.ok) {
      setBusy(false)
      const data = await res.json().catch(() => ({}))
      alert(data.error ?? "No se pudo borrar")
      return
    }
    router.push("/")
    router.refresh()
  }

  return (
    <div className="mb-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          {editingName ? (
            <input
              ref={nameRef}
              value={name}
              disabled={busy}
              autoFocus
              onChange={(e) => setName(e.target.value)}
              onBlur={commitName}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitName()
                if (e.key === "Escape") { setName(topic.name); setEditingName(false) }
              }}
              className="rounded border border-ring bg-background px-1.5 py-0.5 text-2xl font-semibold tracking-tight outline-none focus:ring-2 focus:ring-ring/30 disabled:opacity-50"
            />
          ) : (
            <h1
              className="group cursor-text text-2xl font-semibold tracking-tight"
              onClick={() => setEditingName(true)}
              title="Click para editar"
            >
              {name}
              <span className="ml-2 align-middle text-xs text-muted-foreground opacity-0 transition-opacity group-hover:opacity-60">
                ✎
              </span>
            </h1>
          )}
          {topic.group_name && <Badge variant="outline">{topic.group_name}</Badge>}
        </div>

        <Button
          variant="destructive"
          size="sm"
          disabled={busy}
          onClick={remove}
          title="Borrar topic"
        >
          <IconTrash className="size-3.5" />
          Borrar
        </Button>
      </div>

      {/* Description */}
      {editingDesc ? (
        <textarea
          value={description}
          disabled={busy}
          autoFocus
          rows={2}
          placeholder="Descripción del topic…"
          onChange={(e) => setDescription(e.target.value)}
          onBlur={commitDesc}
          onKeyDown={(e) => {
            if (e.key === "Escape") { setDescription(topic.description ?? ""); setEditingDesc(false) }
          }}
          className="mt-2 w-full rounded border border-ring bg-background px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-ring/30 disabled:opacity-50"
        />
      ) : description ? (
        <p
          className="group mt-2 cursor-text text-sm text-muted-foreground"
          onClick={() => setEditingDesc(true)}
          title="Click para editar"
        >
          {description}
          <span className="ml-1.5 text-xs opacity-0 transition-opacity group-hover:opacity-60">✎</span>
        </p>
      ) : (
        <button
          onClick={() => setEditingDesc(true)}
          className="mt-2 text-xs text-muted-foreground underline-offset-4 hover:underline"
        >
          + Agregar descripción
        </button>
      )}

      <p className="mt-1 text-xs text-muted-foreground">
        {recallCount} recall{recallCount !== 1 ? "s" : ""} · {quickReviewCount} quick review{quickReviewCount !== 1 ? "s" : ""}
      </p>
    </div>
  )
}
