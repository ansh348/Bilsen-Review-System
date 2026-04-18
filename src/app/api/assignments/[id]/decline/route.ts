import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-helpers";
import { declineAssignment } from "@/lib/review-service";
import { handleRouteError, jsonError } from "@/lib/api-route";
import { declineAssignmentSchema } from "@/lib/validations/review";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return jsonError("Unauthorized", 401);
    }

    const { id } = await params;
    const body = await request.json();
    const parsed = declineAssignmentSchema.parse(body);

    const assignment = declineAssignment(id, user.id, parsed.reason);
    return NextResponse.json({ assignment });
  } catch (error) {
    return handleRouteError(error);
  }
}
