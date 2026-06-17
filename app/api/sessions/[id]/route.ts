import { NextResponse } from "next/server"
import { deleteReviewSession } from "@/lib/db-mcp"
import { currentUserId } from "@/lib/auth"

export const dynamic = "force-dynamic"

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const sessionId = parseInt(id, 10)
    if (isNaN(sessionId)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 })
    }

    const result = await deleteReviewSession(sessionId, await currentUserId())
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 404 })
    }
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: "Failed to delete session" }, { status: 500 })
  }
}
