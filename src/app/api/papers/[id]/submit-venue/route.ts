import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedUser } from "@/lib/auth-helpers";
import { handleRouteError, jsonError } from "@/lib/api-route";
import { getPaperById, submitPaperToVenue } from "@/lib/review-service";

interface Params {
  params: Promise<{ id: string }>;
}

const submitSchema = z.object({
  venueId: z.string().min(1),
});

export async function POST(request: Request, { params }: Params) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return jsonError("Unauthorized", 401);

    const { id } = await params;
    const paper = getPaperById(id);
    if (!paper) return jsonError("Paper not found", 404);

    const isAuthor = paper.authorIds.includes(user.id);
    if (!isAuthor && user.role !== "COORDINATOR") {
      return jsonError("Only paper authors or coordinators can submit", 403);
    }

    const body = await request.json();
    const parsed = submitSchema.parse(body);

    const result = await submitPaperToVenue(id, parsed.venueId);
    if (result.failedChecks.length > 0) {
      return NextResponse.json(
        {
          error: "Compliance checks not all passed",
          failedChecks: result.failedChecks.map((c) => ({
            checkType: c.checkType,
            details: c.details,
          })),
        },
        { status: 400 },
      );
    }
    return NextResponse.json({ paper: result.paper });
  } catch (error) {
    return handleRouteError(error);
  }
}
