"use client"

import { useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface Props {
  groups: string[]
  currentGroup?: string
  currentSort?: string
  currentSearch?: string
}

export function DashboardFilters({ groups, currentGroup, currentSort, currentSearch }: Props) {
  const router = useRouter()
  const [search, setSearch] = useState(currentSearch ?? "")
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function update(key: "group" | "sort" | "search", value: string) {
    const params = new URLSearchParams(window.location.search)
    if (!value || value === "all" || value === "name") {
      params.delete(key)
    } else {
      params.set(key, value)
    }
    router.push(`/?${params.toString()}`)
  }

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      update("search", search)
    }, 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [search])

  return (
    <div className="flex flex-wrap gap-3">
      <input
        type="search"
        placeholder="Buscar topic…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="h-9 w-56 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
      />

      <Select
        value={currentGroup ?? "all"}
        onValueChange={(v) => update("group", v)}
      >
        <SelectTrigger className="w-48">
          <SelectValue placeholder="All groups" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All groups</SelectItem>
          {groups.map((g) => (
            <SelectItem key={g} value={g}>
              {g}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={currentSort ?? "name"}
        onValueChange={(v) => update("sort", v)}
      >
        <SelectTrigger className="w-52">
          <SelectValue placeholder="Sort by name" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="name">Sort: Name</SelectItem>
          <SelectItem value="score_desc">Sort: Score ↓</SelectItem>
          <SelectItem value="score_asc">Sort: Score ↑</SelectItem>
          <SelectItem value="date_desc">Sort: Date ↓</SelectItem>
          <SelectItem value="date_asc">Sort: Date ↑</SelectItem>
        </SelectContent>
      </Select>
    </div>
  )
}
