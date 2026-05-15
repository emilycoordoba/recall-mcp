import { NextResponse } from "next/server"
import { getTopic, getSubsections, getRecalls, getRecallSubsections } from "@/lib/db"
import { updateTopicById } from "@/lib/db-mcp"
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
    const name = typeof body?.name === "string" ? body.name.trim() : undefined
    if (!name) {
      return NextResponse.json({ error: "name is required" }, { status: 400 })
    }

    const result = await updateTopicById(topicId, { name }, await currentUserId())
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 409 })
    }
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: "Failed to update topic" }, { status: 500 })
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
