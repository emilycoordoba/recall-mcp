import { NextResponse } from "next/server"
import { getTopics } from "@/lib/db"

export const dynamic = "force-dynamic"

export function GET() {
  try {
    const topics = getTopics()
    return NextResponse.json(topics)
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: "Failed to load topics" }, { status: 500 })
  }
}
