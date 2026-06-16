import { NextResponse } from "next/server"
import { getUserSettings, updateUserSettings, clampReviewSlots, type UserSettings } from "@/lib/db-mcp"
import { currentUserId } from "@/lib/auth"
import { isValidTimeZone } from "@/lib/dates"

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
    // Clamp to the supported range so a bad value can't make get_review_plan
    // emit zero or absurdly many slots.
    if (typeof body?.review_slots === "number" && Number.isFinite(body.review_slots)) {
      patch.review_slots = clampReviewSlots(body.review_slots)
    }
    if (typeof body?.adaptive_difficulty === "boolean") {
      patch.adaptive_difficulty = body.adaptive_difficulty
    }
    // Only accept real IANA zone ids so a bad client value can't corrupt every
    // server-side day computation (streak, SM-2, day headers).
    if (isValidTimeZone(body?.timezone)) {
      patch.timezone = body.timezone
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
