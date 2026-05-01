import { NextResponse } from "next/server";
import { requireCoordinatorUser } from "@/lib/auth-helpers";
import { handleRouteError, jsonError } from "@/lib/api-route";
import {
  generateAndStoreFinalReport,
  getLatestAiReportForPaper,
  getPaperById,
} from "@/lib/review-service";

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: Params) {
  try {
    const { allowed, reason } = await requireCoordinatorUser();
    if (!allowed) {
      return jsonError(reason === "UNAUTHENTICATED" ? "Unauthorized" : "Forbidden", reason === "UNAUTHENTICATED" ? 401 : 403);
    }
    const { id } = await params;
    if (!getPaperById(id)) return jsonError("Paper not found", 404);
    const report = getLatestAiReportForPaper(id);
    return NextResponse.json({ report });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(_request: Request, { params }: Params) {
  try {
    const { allowed, reason } = await requireCoordinatorUser();
    if (!allowed) {
      return jsonError(reason === "UNAUTHENTICATED" ? "Unauthorized" : "Forbidden", reason === "UNAUTHENTICATED" ? 401 : 403);
    }
    const { id } = await params;
    if (!getPaperById(id)) return jsonError("Paper not found", 404);
    const report = await generateAndStoreFinalReport(id);
    return NextResponse.json({ report });
  } catch (error) {
    return handleRouteError(error);
  }
}
