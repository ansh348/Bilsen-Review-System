import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-helpers";
import { handleRouteError, jsonError } from "@/lib/api-route";
import {
  canUserAccessPaper,
  getPaperById,
  listPaperVersionsForPaper,
} from "@/lib/review-service";

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
    const paper = getPaperById(id);
    if (!paper) {
      return jsonError("Paper not found", 404);
    }
    if (!canUserAccessPaper(paper.id, user.id, user.role)) {
      return jsonError("Forbidden", 403);
    }

    return NextResponse.json({ versions: listPaperVersionsForPaper(id) });
  } catch (error) {
    return handleRouteError(error);
  }
}
