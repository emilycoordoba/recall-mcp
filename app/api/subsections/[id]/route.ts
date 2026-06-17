import { NextResponse } from "next/server"
import { updateSubsectionNameById, updateSubsectionKindById } from "@/lib/db-mcp"
import { isSubsectionKind } from "@/lib/topic-kind"
import { currentUserId } from "@/lib/auth"

export const dynamic = "force-dynamic"

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const subId = parseInt(id, 10)
    if (isNaN(subId)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 })
    }

    const body = await req.json()
    const userId = await currentUserId()

    // PATCH soporta dos campos independientes: renombrar (name) y reclasificar (kind).
    if (body?.kind !== undefined) {
      if (!isSubsectionKind(body.kind)) {
        return NextResponse.json({ error: "kind inválido" }, { status: 400 })
      }
      const result = await updateSubsectionKindById(subId, body.kind, userId)
      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 409 })
      }
      return NextResponse.json({ ok: true })
    }

    const name = typeof body?.name === "string" ? body.name.trim() : ""
    if (!name) {
      return NextResponse.json({ error: "El nombre no puede estar vacío" }, { status: 400 })
    }

    const result = await updateSubsectionNameById(subId, name, userId)
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 409 })
    }
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: "Failed to update subsection" }, { status: 500 })
  }
}
