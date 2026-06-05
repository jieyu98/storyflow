import { NextResponse } from "next/server";
import { apiError } from "@/lib/http";
import { usageSummary } from "@/server/db";

export const runtime = "nodejs";

// GET /api/usage            → global spend summary
// GET /api/usage?projectId= → spend for one project
export async function GET(req: Request) {
  try {
    const projectId =
      new URL(req.url).searchParams.get("projectId") ?? undefined;
    return NextResponse.json(usageSummary(projectId));
  } catch (err) {
    return apiError(err);
  }
}
