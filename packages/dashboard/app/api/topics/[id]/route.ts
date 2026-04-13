import { NextResponse } from "next/server"
import { getTopic, getSubsections, getRecalls, getRecallSubsections } from "@/lib/db"

export const dynamic = "force-dynamic"

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

    const topic = getTopic(topicId)
    if (!topic) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const subsections = getSubsections(topicId)
    const recalls = getRecalls(topicId).map((recall) => ({
      ...recall,
      subsections: getRecallSubsections(recall.id),
    }))

    return NextResponse.json({ topic, subsections, recalls })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: "Failed to load topic" }, { status: 500 })
  }
}
