import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-helpers";
import { canUserAccessPaper, getRoundDetails } from "@/lib/review-service";
import { handleRouteError, jsonError } from "@/lib/api-route";

interface RouteParams {
  params: Promise<{ id: string; roundId: string }>;
}

export async function GET(_: Request, { params }: RouteParams) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return jsonError("Unauthorized", 401);
    }

    const { id, roundId } = await params;
    if (!canUserAccessPaper(id, user.id, user.role)) {
      return jsonError("Forbidden", 403);
    }

    const details = getRoundDetails(id, roundId);
    if (!details) {
      return jsonError("Round not found", 404);
    }

    return NextResponse.json(details);
  } catch (error) {
    return handleRouteError(error);
  }
}
