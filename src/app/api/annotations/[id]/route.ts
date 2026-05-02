import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-helpers";
import { handleRouteError, jsonError } from "@/lib/api-route";
import { canUserAccessPaper } from "@/lib/review-service";
import {
  deleteAnnotation,
  getAnnotationById,
  updateAnnotation,
} from "@/lib/annotation-service";
import { updateAnnotationSchema } from "@/lib/validations/annotation";

interface Params {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return jsonError("Unauthorized", 401);

    const { id } = await params;
    const existing = getAnnotationById(id);
    if (!existing) return jsonError("Annotation not found", 404);
    if (!canUserAccessPaper(existing.paperId, user.id, user.role)) {
      return jsonError("Forbidden", 403);
    }

    const body = await request.json();
    const parsed = updateAnnotationSchema.parse(body);

    try {
      const updated = updateAnnotation(id, user.id, user.role, parsed);
      return NextResponse.json({ annotation: updated });
    } catch (error) {
      if (error instanceof Error && error.message.includes("cannot edit")) {
        return jsonError(error.message, 403);
      }
      throw error;
    }
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(_: Request, { params }: Params) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return jsonError("Unauthorized", 401);

    const { id } = await params;
    const existing = getAnnotationById(id);
    if (!existing) return jsonError("Annotation not found", 404);
    if (!canUserAccessPaper(existing.paperId, user.id, user.role)) {
      return jsonError("Forbidden", 403);
    }

    try {
      deleteAnnotation(id, user.id, user.role);
      return NextResponse.json({ success: true });
    } catch (error) {
      if (error instanceof Error && error.message.includes("cannot delete")) {
        return jsonError(error.message, 403);
      }
      throw error;
    }
  } catch (error) {
    return handleRouteError(error);
  }
}
