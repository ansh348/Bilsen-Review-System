import { NextResponse } from "next/server";
import { getAuthenticatedUser, requireCoordinatorUser } from "@/lib/auth-helpers";
import {
  canUserAccessPaper,
  createReviewRound,
  getPaperById,
  listRoundsForPaper,
} from "@/lib/review-service";
import { handleRouteError, jsonError } from "@/lib/api-route";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_: Request, { params }: RouteParams) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return jsonError("Unauthorized", 401);
    }

    const { id } = await params;
    if (!getPaperById(id)) {
      return jsonError("Paper not found", 404);
    }

    if (!canUserAccessPaper(id, user.id, user.role)) {
      return jsonError("Forbidden", 403);
    }

    const rounds = listRoundsForPaper(id);
    return NextResponse.json({ rounds });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(_: Request, { params }: RouteParams) {
  try {
    const authz = await requireCoordinatorUser();
    if (!authz.allowed) {
      return jsonError(
        authz.reason === "UNAUTHENTICATED" ? "Unauthorized" : "Forbidden",
        authz.reason === "UNAUTHENTICATED" ? 401 : 403
      );
    }

    const { id } = await params;
    const round = createReviewRound(id);
    return NextResponse.json({ round }, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
