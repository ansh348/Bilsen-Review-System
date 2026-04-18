import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-helpers";
import { handleRouteError, jsonError } from "@/lib/api-route";
import { generateAiReviewDraft } from "@/lib/review-service";
import { aiReviewSchema } from "@/lib/validations/review";

export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return jsonError("Unauthorized", 401);
    }

    const body = await request.json();
    const parsed = aiReviewSchema.parse(body);
    const review = await generateAiReviewDraft(parsed.extractedText);
    return NextResponse.json({ review });
  } catch (error) {
    return handleRouteError(error);
  }
}
