import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-helpers";
import { handleRouteError, jsonError } from "@/lib/api-route";
import { generateAiSuggestions } from "@/lib/review-service";
import { aiReviewSchema } from "@/lib/validations/review";

export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return jsonError("Unauthorized", 401);
    }

    const body = await request.json();
    const parsed = aiReviewSchema.parse(body);
    const suggestions = await generateAiSuggestions(parsed.extractedText);
    return NextResponse.json({ suggestions });
  } catch (error) {
    return handleRouteError(error);
  }
}
