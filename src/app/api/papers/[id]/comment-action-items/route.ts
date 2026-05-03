import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-helpers";
import { handleRouteError, jsonError } from "@/lib/api-route";
import { canUserAccessPaper, getPaperById } from "@/lib/review-service";
import { listAnnotationsForPaper } from "@/lib/annotation-service";
import { listAllUsers } from "@/lib/users";
import {
  CommentActionItemDraft,
  listCommentActionItemsForPaper,
  replaceCommentActionItemsForPaper,
} from "@/lib/comment-action-service";
import {
  CommentForExtraction,
  extractActionItemsFromComments,
} from "@/lib/ai";

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(_: Request, { params }: Params) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return jsonError("Unauthorized", 401);

    const { id } = await params;
    const paper = getPaperById(id);
    if (!paper) return jsonError("Paper not found", 404);
    if (!canUserAccessPaper(paper.id, user.id, user.role)) {
      return jsonError("Forbidden", 403);
    }

    return NextResponse.json({
      items: listCommentActionItemsForPaper(paper.id),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(_: Request, { params }: Params) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return jsonError("Unauthorized", 401);

    const { id } = await params;
    const paper = getPaperById(id);
    if (!paper) return jsonError("Paper not found", 404);
    if (!canUserAccessPaper(paper.id, user.id, user.role)) {
      return jsonError("Forbidden", 403);
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return jsonError("AI extraction is not configured", 503);
    }

    const commentAnnotations = listAnnotationsForPaper(
      paper.id,
      user.id,
      user.role,
      { kind: "COMMENT" }
    );

    if (commentAnnotations.length === 0) {
      const items = replaceCommentActionItemsForPaper(paper.id, []);
      return NextResponse.json({ items });
    }

    const userMap = new Map(listAllUsers().map((u) => [u.id, u.name]));

    const inputs: CommentForExtraction[] = commentAnnotations
      .filter((a) => a.comment !== undefined)
      .map((a) => ({
        id: a.id,
        text: a.comment!.text,
        severity: a.comment!.severity ?? null,
        pageNumber: a.pageNumber,
        authorName: userMap.get(a.authorId) ?? "Unknown",
      }));

    const extracted = await extractActionItemsFromComments(inputs);

    const idToPage = new Map(commentAnnotations.map((a) => [a.id, a.pageNumber]));
    const drafts: CommentActionItemDraft[] = extracted.map((item) => {
      const pages = Array.from(
        new Set(
          item.sourceCommentIds
            .map((cid) => idToPage.get(cid))
            .filter((p): p is number => typeof p === "number")
        )
      ).sort((a, b) => a - b);
      return {
        text: item.text,
        severity: item.severity,
        sourceCommentIds: item.sourceCommentIds,
        sourcePages: pages,
      };
    });

    const items = replaceCommentActionItemsForPaper(paper.id, drafts);
    return NextResponse.json({ items });
  } catch (error) {
    return handleRouteError(error);
  }
}
