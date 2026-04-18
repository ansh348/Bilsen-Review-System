import { NextResponse } from "next/server";
import { getAuthenticatedUser, requireCoordinatorUser } from "@/lib/auth-helpers";
import { createVenue, listVenues } from "@/lib/review-service";
import { handleRouteError, jsonError } from "@/lib/api-route";
import { createVenueSchema } from "@/lib/validations/review";

export async function GET() {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return jsonError("Unauthorized", 401);
    }

    const venues = listVenues();
    return NextResponse.json({ venues });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const authz = await requireCoordinatorUser();
    if (!authz.allowed) {
      return jsonError(
        authz.reason === "UNAUTHENTICATED" ? "Unauthorized" : "Forbidden",
        authz.reason === "UNAUTHENTICATED" ? 401 : 403
      );
    }

    const body = await request.json();
    const parsed = createVenueSchema.parse(body);
    const venue = createVenue(parsed);
    return NextResponse.json({ venue }, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
