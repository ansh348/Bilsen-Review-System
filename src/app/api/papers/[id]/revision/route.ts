import { NextResponse } from "next/server";
import { requireCoordinatorUser } from "@/lib/auth-helpers";
import { getPaperById, markForRevision } from "@/lib/review-service";
import { handleRouteError, jsonError } from "@/lib/api-route";

interface RouteParams {
  params: Promise<{ id: string }>;
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

    const { id } = await params;
    if (!getPaperById(id)) {
      return jsonError("Paper not found", 404);
    }

    const body = await request.json().catch(() => ({}));
    const note = typeof body?.note === "string" ? body.note : null;

    const paper = markForRevision(id, note);
    return NextResponse.json({ paper });
  } catch (error) {
    return handleRouteError(error);
  }
}
