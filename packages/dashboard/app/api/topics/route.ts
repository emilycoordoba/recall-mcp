import { NextResponse } from "next/server"
import { getTopics } from "@/lib/db"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const topics = await getTopics()
    return NextResponse.json(topics)
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: "Failed to load topics" }, { status: 500 })
  }
}
