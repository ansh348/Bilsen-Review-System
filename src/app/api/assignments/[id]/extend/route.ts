import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-helpers";
import { requestAssignmentExtension } from "@/lib/review-service";
import { handleRouteError, jsonError } from "@/lib/api-route";
import { requestExtensionSchema } from "@/lib/validations/review";

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
    const parsed = requestExtensionSchema.parse(body);
    const assignment = requestAssignmentExtension(id, user.id, parsed.requestedDate);

    return NextResponse.json({ assignment });
  } catch (error) {
    return handleRouteError(error);
  }
}
