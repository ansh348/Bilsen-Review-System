import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-helpers";
import { handleRouteError, jsonError } from "@/lib/api-route";
import {
  canUserAccessPaper,
  getComplianceChecksByPaper,
  getPaperById,
} from "@/lib/review-service";

interface RouteParams {
  params: Promise<{ paperId: string }>;
}

export async function GET(_: Request, { params }: RouteParams) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return jsonError("Unauthorized", 401);
    }

    const { paperId } = await params;
    if (!getPaperById(paperId)) {
      return jsonError("Paper not found", 404);
    }

    if (!canUserAccessPaper(paperId, user.id, user.role)) {
      return jsonError("Forbidden", 403);
    }

    const checks = getComplianceChecksByPaper(paperId);
    return NextResponse.json({ checks });
  } catch (error) {
    return handleRouteError(error);
  }
}
