import { NextResponse } from "next/server"
import { deleteGroup } from "@/lib/db-mcp"
import { currentUserId } from "@/lib/auth"

export const dynamic = "force-dynamic"

// DELETE — borra el grupo entero (no sus topics).
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const groupId = parseInt(id, 10)
    if (isNaN(groupId)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 })
    }

    const result = await deleteGroup(groupId, await currentUserId())
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 409 })
    }
    return NextResponse.json({ ok: true, deleted_group: result.deleted_group })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: "Failed to delete group" }, { status: 500 })
  }
}
