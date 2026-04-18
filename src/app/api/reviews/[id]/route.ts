import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-helpers";
import {
  canUserAccessReview,
  getReviewById,
  updateReview,
} from "@/lib/review-service";
import { handleRouteError, jsonError } from "@/lib/api-route";
import { reviewUpdateSchema } from "@/lib/validations/review";

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
    const review = getReviewById(id);
    if (!review) {
      return jsonError("Review not found", 404);
    }

    if (!canUserAccessReview(id, user.id, user.role)) {
      return jsonError("Forbidden", 403);
    }

    return NextResponse.json({ review });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return jsonError("Unauthorized", 401);
    }

    const { id } = await params;
    const body = await request.json();
    const parsed = reviewUpdateSchema.parse(body);
    const review = updateReview(id, user.id, parsed);
    return NextResponse.json({ review });
  } catch (error) {
    return handleRouteError(error);
  }
}
