import { NextResponse } from "next/server"
import { getTopics } from "@/lib/db"
import { currentUserId } from "@/lib/auth"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const topics = await getTopics(await currentUserId())
    return NextResponse.json(topics)
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: "Failed to load topics" }, { status: 500 })
  }
}
