import { NextResponse } from "next/server"
import { getGroups } from "@/lib/db"
import { currentUserId } from "@/lib/auth"

export const dynamic = "force-dynamic"

// Lista todos los grupos del usuario (para el selector de grupos del dashboard).
export async function GET() {
  try {
    const groups = await getGroups(await currentUserId())
    return NextResponse.json({ groups })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: "Failed to load groups" }, { status: 500 })
  }
}
