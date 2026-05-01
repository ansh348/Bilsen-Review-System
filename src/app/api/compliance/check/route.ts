import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-helpers";
import { handleRouteError, jsonError } from "@/lib/api-route";
import {
  canUserManagePaper,
  getPaperById,
  runComplianceChecks,
} from "@/lib/review-service";
import { complianceCheckSchema } from "@/lib/validations/review";

export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return jsonError("Unauthorized", 401);
    }

    const body = await request.json();
    const parsed = complianceCheckSchema.parse(body);

    if (!getPaperById(parsed.paperId)) {
      return jsonError("Paper not found", 404);
    }

    if (!canUserManagePaper(parsed.paperId, user.id, user.role)) {
      return jsonError("Forbidden", 403);
    }

    const checks = await runComplianceChecks(parsed);
    return NextResponse.json({ checks });
  } catch (error) {
    return handleRouteError(error);
  }
}
