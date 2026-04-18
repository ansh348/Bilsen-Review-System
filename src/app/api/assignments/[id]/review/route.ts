import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-helpers";
import { submitReviewForAssignment } from "@/lib/review-service";
import { handleRouteError, jsonError } from "@/lib/api-route";
import { reviewSubmissionSchema } from "@/lib/validations/review";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return jsonError("Unauthorized", 401);
    }

    const { id } = await params;
    const body = await request.json();
    const parsed = reviewSubmissionSchema.parse(body);

    const result = submitReviewForAssignment(id, user.id, parsed);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
