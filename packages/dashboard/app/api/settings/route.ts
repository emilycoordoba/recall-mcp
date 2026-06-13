import { NextResponse } from "next/server"
import { getUserSettings, updateUserSettings, type UserSettings } from "@/lib/db-mcp"
import { currentUserId } from "@/lib/auth"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const settings = await getUserSettings(await currentUserId())
    return NextResponse.json(settings)
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: "Failed to load settings" }, { status: 500 })
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json()

    // Whitelist known keys so the client can't write arbitrary jsonb. Each key is
    // validated for its expected type; unknown keys are simply ignored.
    const patch: Partial<UserSettings> = {}
    if (typeof body?.review_only_practiced === "boolean") {
      patch.review_only_practiced = body.review_only_practiced
    }
    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: "No valid settings in body" }, { status: 400 })
    }

    const settings = await updateUserSettings(await currentUserId(), patch)
    return NextResponse.json(settings)
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: "Failed to update settings" }, { status: 500 })
  }
}
