import { NextResponse } from "next/server"
import { updateQuickReviewDifficulty } from "@/lib/db-mcp"
import { currentUserId } from "@/lib/auth"

export const dynamic = "force-dynamic"

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const quickReviewId = parseInt(id, 10)
    if (isNaN(quickReviewId)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 })
    }

    const body = await req.json()
    // difficulty: 1-5 to set, null to clear. Anything else is a bad request.
    if (!(body?.difficulty === null || Number.isInteger(body?.difficulty))) {
      return NextResponse.json({ error: "difficulty debe ser un entero 1-5 o null" }, { status: 400 })
    }

    const result = await updateQuickReviewDifficulty(
      quickReviewId,
      body.difficulty,
      await currentUserId(),
    )
    if (!result.success) {
      const status = result.error?.includes("no encontrado") ? 404 : 400
      return NextResponse.json({ error: result.error }, { status })
    }
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: "Failed to update quick review" }, { status: 500 })
  }
}
