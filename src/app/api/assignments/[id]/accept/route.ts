import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-helpers";
import { acceptAssignment } from "@/lib/review-service";
import { handleRouteError, jsonError } from "@/lib/api-route";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(_: Request, { params }: RouteParams) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return jsonError("Unauthorized", 401);
    }

    const { id } = await params;
    const assignment = acceptAssignment(id, user.id);
    return NextResponse.json({ assignment });
  } catch (error) {
    return handleRouteError(error);
  }
}
