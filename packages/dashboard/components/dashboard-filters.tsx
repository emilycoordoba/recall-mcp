"use client"

import { useRouter } from "next/navigation"
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
}

export function DashboardFilters({ groups, currentGroup, currentSort }: Props) {
  const router = useRouter()

  function update(key: "group" | "sort", value: string) {
    const params = new URLSearchParams(window.location.search)
    if (value === "all" || value === "name") {
      params.delete(key)
    } else {
      params.set(key, value)
    }
    router.push(`/?${params.toString()}`)
  }

  return (
    <div className="flex flex-wrap gap-3">
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
