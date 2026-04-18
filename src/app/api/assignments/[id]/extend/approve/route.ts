import { NextResponse } from "next/server";
import { requireCoordinatorUser } from "@/lib/auth-helpers";
import { approveAssignmentExtension } from "@/lib/review-service";
import { handleRouteError, jsonError } from "@/lib/api-route";
import { approveExtensionSchema } from "@/lib/validations/review";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const authz = await requireCoordinatorUser();
    if (!authz.allowed) {
      return jsonError(
        authz.reason === "UNAUTHENTICATED" ? "Unauthorized" : "Forbidden",
        authz.reason === "UNAUTHENTICATED" ? 401 : 403
      );
    }

    const { id } = await params;
    const body = await request.json();
    const parsed = approveExtensionSchema.parse(body);

    const assignment = approveAssignmentExtension(
      id,
      parsed.newDeadline,
      parsed.approved
    );
    return NextResponse.json({ assignment });
  } catch (error) {
    return handleRouteError(error);
  }
}
