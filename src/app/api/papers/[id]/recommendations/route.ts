import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-helpers";
import { handleRouteError, jsonError } from "@/lib/api-route";
import {
  canUserAccessPaper,
  getPaperById,
  getVenueRecommendations,
} from "@/lib/review-service";

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: Params) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return jsonError("Unauthorized", 401);
    const { id } = await params;
    if (!getPaperById(id)) return jsonError("Paper not found", 404);
    if (!canUserAccessPaper(id, user.id, user.role)) return jsonError("Forbidden", 403);

    const recommendations = await getVenueRecommendations(id, 5);
    return NextResponse.json({ recommendations });
  } catch (error) {
    return handleRouteError(error);
  }
}
