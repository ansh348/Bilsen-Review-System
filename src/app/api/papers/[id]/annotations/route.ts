import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-helpers";
import { handleRouteError, jsonError } from "@/lib/api-route";
import { canUserAccessPaper, getPaperById } from "@/lib/review-service";
import {
  createAnnotation,
  listAnnotationsForPaper,
} from "@/lib/annotation-service";
import { createAnnotationSchema } from "@/lib/validations/annotation";
import { AnnotationRecord } from "@/lib/review-types";

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, { params }: Params) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return jsonError("Unauthorized", 401);

    const { id } = await params;
    const paper = getPaperById(id);
    if (!paper) return jsonError("Paper not found", 404);
    if (!canUserAccessPaper(paper.id, user.id, user.role)) {
      return jsonError("Forbidden", 403);
    }

    const url = new URL(request.url);
    const pageParam = url.searchParams.get("page");
    const kindParam = url.searchParams.get("kind") as
      | AnnotationRecord["kind"]
      | null;
    const authorIdParam = url.searchParams.get("authorId");

    const annotations = listAnnotationsForPaper(paper.id, user.id, user.role, {
      page: pageParam ? Number(pageParam) : undefined,
      kind: kindParam ?? undefined,
      authorId: authorIdParam ?? undefined,
    });

    return NextResponse.json({ annotations });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request, { params }: Params) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return jsonError("Unauthorized", 401);

    const { id } = await params;
    const paper = getPaperById(id);
    if (!paper) return jsonError("Paper not found", 404);
    if (!canUserAccessPaper(paper.id, user.id, user.role)) {
      return jsonError("Forbidden", 403);
    }

    const body = await request.json();
    const parsed = createAnnotationSchema.parse(body);
    const annotation = createAnnotation(paper.id, user.id, parsed);
    return NextResponse.json({ annotation }, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
