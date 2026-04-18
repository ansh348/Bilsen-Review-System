import { NextResponse } from "next/server";
import { getAuthenticatedUser, requireCoordinatorUser } from "@/lib/auth-helpers";
import {
  canUserAccessPaper,
  canUserManagePaper,
  deletePaper,
  getPaperDetails,
  updatePaper,
} from "@/lib/review-service";
import { handleRouteError, jsonError } from "@/lib/api-route";
import { updatePaperSchema } from "@/lib/validations/review";

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
    const details = getPaperDetails(id);
    if (!details) {
      return jsonError("Paper not found", 404);
    }

    if (!canUserAccessPaper(id, user.id, user.role)) {
      return jsonError("Forbidden", 403);
    }

    return NextResponse.json(details);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return jsonError("Unauthorized", 401);
    }

    const { id } = await params;
    const details = getPaperDetails(id);
    if (!details) {
      return jsonError("Paper not found", 404);
    }

    const isCoordinator = user.role === "COORDINATOR";
    if (!canUserManagePaper(id, user.id, user.role)) {
      return jsonError("Forbidden", 403);
    }

    const body = await request.json();
    const parsed = updatePaperSchema.parse(body);
    if (parsed.status && !isCoordinator) {
      return jsonError("Only coordinators can update paper status", 403);
    }
    const paper = updatePaper(id, parsed);
    return NextResponse.json({ paper });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(_: Request, { params }: RouteParams) {
  try {
    const authz = await requireCoordinatorUser();
    if (!authz.allowed) {
      return jsonError(
        authz.reason === "UNAUTHENTICATED" ? "Unauthorized" : "Forbidden",
        authz.reason === "UNAUTHENTICATED" ? 401 : 403
      );
    }

    const { id } = await params;
    deletePaper(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
