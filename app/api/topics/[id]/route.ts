import { NextResponse } from "next/server"
import { getTopic, getSubsections, getRecalls, getRecallSubsections } from "@/lib/db"
import { updateTopicById, deleteTopic } from "@/lib/db-mcp"
import { currentUserId } from "@/lib/auth"

export const dynamic = "force-dynamic"

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const topicId = parseInt(id, 10)
    if (isNaN(topicId)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 })
    }

    const body = await req.json()
    const updates: { name?: string; description?: string | null } = {}
    if (typeof body?.name === "string") {
      const name = body.name.trim()
      if (!name) return NextResponse.json({ error: "El nombre no puede estar vacío" }, { status: 400 })
      updates.name = name
    }
    // description: string sets it, null clears it. Absent key = leave unchanged.
    if (typeof body?.description === "string") updates.description = body.description
    else if (body?.description === null) updates.description = null

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "Nada que actualizar" }, { status: 400 })
    }

    const result = await updateTopicById(topicId, updates, await currentUserId())
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 409 })
    }
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: "Failed to update topic" }, { status: 500 })
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const topicId = parseInt(id, 10)
    if (isNaN(topicId)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 })
    }

    const userId = await currentUserId()
    // Resolve the name so we reuse deleteTopic (cascade cleanup) and confirm ownership.
    const topic = await getTopic(topicId, userId)
    if (!topic) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const result = await deleteTopic(topic.name, userId)
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 409 })
    }
    return NextResponse.json({ ok: true, recalls_deleted: result.recalls_deleted })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: "Failed to delete topic" }, { status: 500 })
  }
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const topicId = parseInt(id, 10)
    if (isNaN(topicId)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 })
    }

    const userId = await currentUserId()
    const topic = await getTopic(topicId, userId)
    if (!topic) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const [subsections, rawRecalls] = await Promise.all([
      getSubsections(topicId, userId),
      getRecalls(topicId, userId),
    ])

    const recalls = await Promise.all(
      rawRecalls.map(async (recall) => ({
        ...recall,
        subsections: await getRecallSubsections(recall.id, userId),
      })),
    )

    return NextResponse.json({ topic, subsections, recalls })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: "Failed to load topic" }, { status: 500 })
  }
}
