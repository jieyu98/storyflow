import { NextResponse } from "next/server";
import { listProjects } from "@/server/db";
import { apiError } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json({ projects: listProjects() });
  } catch (err) {
    return apiError(err);
  }
}
