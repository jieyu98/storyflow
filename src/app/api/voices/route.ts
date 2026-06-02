import { NextResponse } from "next/server";
import { listVoices } from "@/lib/elevenlabs";
import { apiError } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const voices = await listVoices();
    return NextResponse.json({ voices });
  } catch (err) {
    return apiError(err);
  }
}
