import { NextResponse } from "next/server";
import { requireCoordinatorUser } from "@/lib/auth-helpers";
import { getOverviewAnalytics } from "@/lib/review-service";
import { handleRouteError, jsonError } from "@/lib/api-route";

export async function GET() {
  try {
    const authz = await requireCoordinatorUser();
    if (!authz.allowed) {
      return jsonError(
        authz.reason === "UNAUTHENTICATED" ? "Unauthorized" : "Forbidden",
        authz.reason === "UNAUTHENTICATED" ? 401 : 403
      );
    }

    const overview = getOverviewAnalytics();
    return NextResponse.json({ overview });
  } catch (error) {
    return handleRouteError(error);
  }
}
