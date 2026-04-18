import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-helpers";
import { getRatingsForReviewer } from "@/lib/review-service";
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
    const ratings = getRatingsForReviewer(id);
    return NextResponse.json({ ratings });
  } catch (error) {
    return handleRouteError(error);
  }
}
