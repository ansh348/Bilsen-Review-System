import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-helpers";
import { markNotificationAsRead } from "@/lib/review-service";
import { handleRouteError, jsonError } from "@/lib/api-route";
import { markReadSchema } from "@/lib/validations/review";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return jsonError("Unauthorized", 401);
    }

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const parsed = markReadSchema.parse(body);
    if (!parsed.read) {
      return jsonError("Only read=true is currently supported", 400);
    }

    const notification = markNotificationAsRead(id, user.id);
    return NextResponse.json({ notification });
  } catch (error) {
    return handleRouteError(error);
  }
}
