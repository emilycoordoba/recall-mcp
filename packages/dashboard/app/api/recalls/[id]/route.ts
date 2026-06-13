import { NextResponse } from "next/server"
import { deleteRecall, updateRecallFeedback } from "@/lib/db-mcp"
import { currentUserId } from "@/lib/auth"

export const dynamic = "force-dynamic"

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const recallId = parseInt(id, 10)
    if (isNaN(recallId)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 })
    }

    const body = await req.json()
    if (typeof body?.feedback !== "string") {
      return NextResponse.json({ error: "feedback debe ser texto" }, { status: 400 })
    }

    const result = await updateRecallFeedback(recallId, body.feedback, await currentUserId())
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 404 })
    }
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: "Failed to update recall" }, { status: 500 })
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const recallId = parseInt(id, 10)
    if (isNaN(recallId)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 })
    }

    const result = await deleteRecall(recallId, await currentUserId())
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 404 })
    }
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: "Failed to delete recall" }, { status: 500 })
  }
}
