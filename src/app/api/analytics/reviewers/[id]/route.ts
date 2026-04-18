import { NextResponse } from "next/server";
import { requireCoordinatorUser } from "@/lib/auth-helpers";
import { getReviewerAnalytics } from "@/lib/review-service";
import { handleRouteError, jsonError } from "@/lib/api-route";
import type { AnalyticsPeriod } from "@/lib/review-types";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const authz = await requireCoordinatorUser();
    if (!authz.allowed) {
      return jsonError(
        authz.reason === "UNAUTHENTICATED" ? "Unauthorized" : "Forbidden",
        authz.reason === "UNAUTHENTICATED" ? 401 : 403
      );
    }

    const { searchParams } = new URL(request.url);
    const period = (searchParams.get("period") as AnalyticsPeriod) || "overall";
    const { id } = await params;
    const reviewer = getReviewerAnalytics(id, period);
    if (!reviewer) {
      return jsonError("Reviewer not found", 404);
    }

    return NextResponse.json({ reviewer });
  } catch (error) {
    return handleRouteError(error);
  }
}
