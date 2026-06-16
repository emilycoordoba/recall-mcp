"use client"

import { useRouter } from "next/navigation"
import { IconArrowLeft } from "@tabler/icons-react"

export function BackButton() {
  const router = useRouter()
  return (
    <button
      onClick={() => router.back()}
      className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
    >
      <IconArrowLeft className="h-4 w-4" />
      Volver
    </button>
  )
}
