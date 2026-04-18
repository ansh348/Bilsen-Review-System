import { NextResponse } from "next/server";
import { requireCoordinatorUser } from "@/lib/auth-helpers";
import { handleRouteError, jsonError } from "@/lib/api-route";
import { assignReviewers } from "@/lib/review-service";
import { assignReviewersSchema } from "@/lib/validations/review";

interface RouteParams {
  params: Promise<{ roundId: string }>;
}

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const authz = await requireCoordinatorUser();
    if (!authz.allowed) {
      return jsonError(
        authz.reason === "UNAUTHENTICATED" ? "Unauthorized" : "Forbidden",
        authz.reason === "UNAUTHENTICATED" ? 401 : 403
      );
    }

    const { roundId } = await params;
    const body = await request.json();
    const parsed = assignReviewersSchema.parse(body);
    const assignments = assignReviewers(roundId, parsed.reviewers);
    return NextResponse.json({ assignments }, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
