import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-helpers";
import { handleRouteError, jsonError } from "@/lib/api-route";
import {
  canUserManagePaper,
  getPaperById,
  runAiComplianceAndReferences,
} from "@/lib/review-service";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST /api/papers/[id]/ai-compliance
// Runs the AI compliance + reference verification agents in parallel against
// the paper's full text + selected venue's rules JSON. Stores two new
// ComplianceCheckRecord rows (AI_FULL_REVIEW and AI_REFERENCE_CHECK).
//
// This endpoint is slow (10-60s) because it makes two large Claude calls; the
// frontend should show a loading indicator and avoid timing out on the user.
export async function POST(_request: Request, { params }: RouteParams) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return jsonError("Unauthorized", 401);
    }

    const { id } = await params;
    if (!getPaperById(id)) {
      return jsonError("Paper not found", 404);
    }

    if (!canUserManagePaper(id, user.id, user.role)) {
      return jsonError("Forbidden", 403);
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return jsonError(
        "ANTHROPIC_API_KEY is not configured. AI compliance is unavailable until an API key is set.",
        503,
      );
    }

    const result = await runAiComplianceAndReferences(id);
    return NextResponse.json({
      aiCompliance: result.aiCompliance,
      aiReferences: result.aiReferences,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

// Allow longer execution for the two parallel Claude calls — extended thinking
// plus per-reference web search can push individual batches past 5 min on long
// bibliographies. Next.js's per-route maxDuration cap depends on the deployment
// platform; on Vercel Pro it goes up to 800s. Local dev ignores this.
export const maxDuration = 600;
