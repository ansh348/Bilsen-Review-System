import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-helpers";
import { handleRouteError, jsonError } from "@/lib/api-route";
import { canUserAccessPaper, getPaperById } from "@/lib/review-service";
import {
  getCommentActionItemById,
  setCommentActionItemCompleted,
} from "@/lib/comment-action-service";
import { commentActionItemPatchSchema } from "@/lib/validations/annotation";

interface Params {
  params: Promise<{ id: string; itemId: string }>;
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return jsonError("Unauthorized", 401);

    const { id, itemId } = await params;
    const paper = getPaperById(id);
    if (!paper) return jsonError("Paper not found", 404);
    if (!canUserAccessPaper(paper.id, user.id, user.role)) {
      return jsonError("Forbidden", 403);
    }

    const existing = getCommentActionItemById(itemId);
    if (!existing || existing.paperId !== paper.id) {
      return jsonError("Action item not found", 404);
    }

    const body = await request.json();
    const parsed = commentActionItemPatchSchema.parse(body);
    const item = setCommentActionItemCompleted(itemId, user.id, parsed.completed);
    return NextResponse.json({ item });
  } catch (error) {
    return handleRouteError(error);
  }
}
