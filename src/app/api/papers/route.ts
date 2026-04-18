import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-helpers";
import { handleRouteError, jsonError } from "@/lib/api-route";
import { createPaper, listPapers } from "@/lib/review-service";
import { createPaperSchema } from "@/lib/validations/review";

export async function GET(request: Request) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return jsonError("Unauthorized", 401);
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const venueId = searchParams.get("venueId");
    const authorId = searchParams.get("authorId");

    const papers = listPapers({
      status,
      venueId,
      authorId,
    });
    return NextResponse.json({ papers });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return jsonError("Unauthorized", 401);
    }

    const body = await request.json();
    const parsed = createPaperSchema.parse(body);

    const paper = createPaper({
      ...parsed,
      authorId: user.id,
    });

    return NextResponse.json({ paper }, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
