"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

type SubsectionKind = "teoria" | "practica"

interface Subsection {
  id: number
  name: string
  kind: SubsectionKind
  mastered: boolean
  practice_count: number
}

function KindChip({ sub }: { sub: Subsection }) {
  const router = useRouter()
  const [kind, setKind] = useState<SubsectionKind>(sub.kind)
  const [busy, setBusy] = useState(false)

  async function toggle() {
    const next: SubsectionKind = kind === "teoria" ? "practica" : "teoria"
    setKind(next) // optimista
    setBusy(true)
    const res = await fetch(`/api/subsections/${sub.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: next }),
    })
    setBusy(false)
    if (!res.ok) {
      setKind(kind) // revertir
      const data = await res.json().catch(() => ({}))
      toast.error(data.error ?? "No se pudo cambiar el tipo")
    } else {
      router.refresh()
    }
  }

  const isPractica = kind === "practica"
  return (
    <button
      onClick={toggle}
      disabled={busy}
      title={`${isPractica ? "Práctica" : "Teoría"} — clic para cambiar`}
      className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium leading-none transition-colors disabled:opacity-50 ${
        isPractica
          ? "bg-violet-500/15 text-violet-600 dark:text-violet-300"
          : "bg-sky-500/15 text-sky-600 dark:text-sky-300"
      }`}
    >
      {isPractica ? "práctica" : "teoría"}
    </button>
  )
}

function SubsectionRow({ sub, index }: { sub: Subsection; index: number }) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(sub.name)
  const [busy, setBusy] = useState(false)

  async function commit() {
    const trimmed = value.trim()
    setEditing(false)
    if (!trimmed || trimmed === sub.name) { setValue(sub.name); return }
    setBusy(true)
    const res = await fetch(`/api/subsections/${sub.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: trimmed }),
    })
    setBusy(false)
    if (!res.ok) {
      setValue(sub.name)
      const data = await res.json().catch(() => ({}))
      toast.error(data.error ?? "No se pudo renombrar")
    } else {
      router.refresh()
    }
  }

  return (
    <li className="flex items-center gap-2 text-sm">
      <span className="w-5 text-right font-mono text-xs text-muted-foreground">{index + 1}.</span>
      {editing ? (
        <input
          value={value}
          disabled={busy}
          autoFocus
          onChange={(e) => setValue(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit()
            if (e.key === "Escape") { setValue(sub.name); setEditing(false) }
          }}
          className="flex-1 rounded-md border border-ring bg-background px-1.5 py-0.5 text-sm outline-none focus:ring-2 focus:ring-ring/30 disabled:opacity-50"
        />
      ) : (
        <span className="group flex flex-1 items-center gap-1.5">
          <span>{value}</span>
          <button
            onClick={() => setEditing(true)}
            title="Renombrar subsección"
            className="text-xs leading-none text-muted-foreground opacity-0 transition-opacity group-hover:opacity-60 hover:!opacity-100"
          >
            ✎
          </button>
        </span>
      )}
      <KindChip sub={sub} />
      {sub.mastered ? (
        <span className="text-xs text-green-600 dark:text-green-400" title="Dominada">✓</span>
      ) : sub.practice_count > 0 ? (
        <span className="text-xs text-amber-500" title="En progreso">○</span>
      ) : null}
      {sub.practice_count > 0 && (
        <span className="font-mono text-xs text-muted-foreground">×{sub.practice_count}</span>
      )}
    </li>
  )
}

export function SubsectionList({ subsections }: { subsections: Subsection[] }) {
  return (
    <ol className="space-y-1">
      {subsections.map((s, i) => (
        <SubsectionRow key={s.id} sub={s} index={i} />
      ))}
    </ol>
  )
}
