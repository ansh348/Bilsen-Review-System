import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-helpers";
import { handleRouteError, jsonError } from "@/lib/api-route";
import {
  canUserManagePaper,
  getPaperById,
  runComplianceChecks,
} from "@/lib/review-service";
import { complianceCheckSchema } from "@/lib/validations/review";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, { params }: RouteParams) {
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

    const payload = await request.json().catch(() => ({}));
    const parsed = complianceCheckSchema.parse({
      ...payload,
      paperId: id,
    });
    const checks = runComplianceChecks(parsed);
    return NextResponse.json({ checks });
  } catch (error) {
    return handleRouteError(error);
  }
}
