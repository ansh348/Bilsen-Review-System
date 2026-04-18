import { NextResponse } from "next/server";
import { requireCoordinatorUser } from "@/lib/auth-helpers";
import { getReviewerLeaderboard } from "@/lib/review-service";
import { handleRouteError, jsonError } from "@/lib/api-route";
import type { AnalyticsPeriod } from "@/lib/review-types";

export async function GET(request: Request) {
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
    const reviewers = getReviewerLeaderboard(period);
    return NextResponse.json({ reviewers });
  } catch (error) {
    return handleRouteError(error);
  }
}
