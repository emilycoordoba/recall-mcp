import { NextResponse } from "next/server"
import { getTopic } from "@/lib/db"
import { mergeTopics } from "@/lib/db-mcp"
import { currentUserId } from "@/lib/auth"

export const dynamic = "force-dynamic"

// Merges the source topic into the target: moves recalls, quick reviews and
// subsections, then deletes the source. Body: { sourceId, targetId }.
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const sourceId = Number(body?.sourceId)
    const targetId = Number(body?.targetId)
    if (!Number.isInteger(sourceId) || !Number.isInteger(targetId)) {
      return NextResponse.json({ error: "sourceId y targetId son requeridos" }, { status: 400 })
    }
    if (sourceId === targetId) {
      return NextResponse.json({ error: "Origen y destino son el mismo topic" }, { status: 400 })
    }

    const userId = await currentUserId()
    // Resolve names (and confirm ownership) so we reuse the proven name-based merge.
    const [source, target] = await Promise.all([
      getTopic(sourceId, userId),
      getTopic(targetId, userId),
    ])
    if (!source || !target) {
      return NextResponse.json({ error: "Topic no encontrado" }, { status: 404 })
    }

    const result = await mergeTopics(source.name, target.name, userId)
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 409 })
    }
    return NextResponse.json({ ok: true, merged_into: result.merged_into, subsections_moved: result.subsections_moved })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: "Failed to merge topics" }, { status: 500 })
  }
}
