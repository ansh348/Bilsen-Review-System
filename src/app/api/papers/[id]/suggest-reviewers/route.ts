import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-helpers";
import { handleRouteError, jsonError } from "@/lib/api-route";
import {
  getPaperById,
  getVenueById,
  listRoundsForPaper,
  listUsers,
} from "@/lib/review-service";
import { readCollection } from "@/lib/data-store";
import {
  suggestReviewers,
  type ReviewerCandidate,
} from "@/lib/ai-reviewer-suggester";
import { detectConflicts } from "@/lib/coi-detection";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST /api/papers/[id]/suggest-reviewers
// Coordinator-only. Calls Claude with the paper title/abstract and the list of
// MEMBER reviewers who have declared expertise tags. Returns ranked suggestions
// for the assign-reviewers UI. Anyone who has already reviewed this paper in a
// prior round is excluded by default.
export async function POST(request: Request, { params }: RouteParams) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return jsonError("Unauthorized", 401);
    }
    if (user.role !== "COORDINATOR") {
      return jsonError("Only coordinators can suggest reviewers", 403);
    }

    const { id } = await params;
    const paper = getPaperById(id);
    if (!paper) {
      return jsonError("Paper not found", 404);
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return jsonError(
        "ANTHROPIC_API_KEY is not configured. Reviewer suggestions are unavailable.",
        503
      );
    }

    const body = (await request.json().catch(() => ({}))) as {
      excludePriorReviewers?: boolean;
      topN?: number;
    };
    const excludePriorReviewers = body.excludePriorReviewers ?? true;
    const topN = body.topN;

    const priorReviewerIds = new Set<string>();
    if (excludePriorReviewers) {
      const roundIds = listRoundsForPaper(paper.id).map((round) => round.id);
      for (const assignment of readCollection("assignments")) {
        if (roundIds.includes(assignment.reviewRoundId)) {
          priorReviewerIds.add(assignment.reviewerId);
        }
      }
    }

    const candidates: ReviewerCandidate[] = listUsers()
      .filter((u) => u.role === "MEMBER")
      .filter((u) => !priorReviewerIds.has(u.id))
      .filter((u) => Array.isArray(u.expertise) && u.expertise.length > 0)
      .filter((u) => detectConflicts(paper, u).length === 0)
      .map((u) => ({
        id: u.id,
        name: u.name,
        expertise: u.expertise ?? [],
      }));

    if (candidates.length === 0) {
      return NextResponse.json({
        suggestions: [],
        modelUsed: null,
        generatedAt: new Date().toISOString(),
        message:
          "No eligible reviewers have declared expertise tags. Ask members to fill in 'Areas of expertise' on their profile.",
      });
    }

    const venue = paper.venueId ? getVenueById(paper.venueId) : null;

    const result = await suggestReviewers({
      paper,
      venue,
      candidates,
      topN,
    });

    if (result.error && result.suggestions.length === 0) {
      return jsonError(
        `Reviewer suggester failed: ${result.error}`,
        result.error === "no-api-key" ? 503 : 502
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    return handleRouteError(error);
  }
}

export const maxDuration = 60;
