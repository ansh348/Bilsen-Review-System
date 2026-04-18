import { NextResponse } from "next/server";
import { requireCoordinatorUser } from "@/lib/auth-helpers";
import { getVenueById, updateVenue } from "@/lib/review-service";
import { handleRouteError, jsonError } from "@/lib/api-route";
import { createVenueSchema } from "@/lib/validations/review";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_: Request, { params }: RouteParams) {
  try {
    const authz = await requireCoordinatorUser();
    if (!authz.allowed) {
      return jsonError(
        authz.reason === "UNAUTHENTICATED" ? "Unauthorized" : "Forbidden",
        authz.reason === "UNAUTHENTICATED" ? 401 : 403
      );
    }

    const { id } = await params;
    const venue = getVenueById(id);
    if (!venue) {
      return jsonError("Venue not found", 404);
    }

    return NextResponse.json({ venue });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const authz = await requireCoordinatorUser();
    if (!authz.allowed) {
      return jsonError(
        authz.reason === "UNAUTHENTICATED" ? "Unauthorized" : "Forbidden",
        authz.reason === "UNAUTHENTICATED" ? 401 : 403
      );
    }

    const body = await request.json();
    const parsed = createVenueSchema.partial().parse(body);
    const { id } = await params;
    const venue = updateVenue(id, parsed);
    return NextResponse.json({ venue });
  } catch (error) {
    return handleRouteError(error);
  }
}
