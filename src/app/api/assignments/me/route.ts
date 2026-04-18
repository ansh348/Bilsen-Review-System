import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-helpers";
import { handleRouteError, jsonError } from "@/lib/api-route";
import { listAssignmentsForReviewer } from "@/lib/review-service";

export async function GET() {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return jsonError("Unauthorized", 401);
    }

    const assignments = listAssignmentsForReviewer(user.id);
    return NextResponse.json({ assignments });
  } catch (error) {
    return handleRouteError(error);
  }
}
