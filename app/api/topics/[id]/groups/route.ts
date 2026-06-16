import { NextResponse } from "next/server"
import { addTopicGroup, removeTopicGroup } from "@/lib/db-mcp"
import { currentUserId } from "@/lib/auth"

export const dynamic = "force-dynamic"

// POST { name } — agrega (get-or-create) un grupo al topic.
export async function POST(
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
    const name = typeof body?.name === "string" ? body.name.trim() : ""
    if (!name) {
      return NextResponse.json({ error: "El nombre del grupo es requerido" }, { status: 400 })
    }

    const result = await addTopicGroup(topicId, name, await currentUserId())
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 409 })
    }
    return NextResponse.json({ ok: true, group: result.group })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: "Failed to add group" }, { status: 500 })
  }
}

// DELETE ?groupId=<n> — quita un grupo del topic.
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const topicId = parseInt(id, 10)
    if (isNaN(topicId)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 })
    }

    const groupId = parseInt(new URL(req.url).searchParams.get("groupId") ?? "", 10)
    if (isNaN(groupId)) {
      return NextResponse.json({ error: "groupId es requerido" }, { status: 400 })
    }

    const result = await removeTopicGroup(topicId, groupId, await currentUserId())
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 409 })
    }
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: "Failed to remove group" }, { status: 500 })
  }
}
