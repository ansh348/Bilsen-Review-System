import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-helpers";
import { handleRouteError, jsonError } from "@/lib/api-route";
import { userUpdateSchema } from "@/lib/validations/review";
import { getUserById, updateUser } from "@/lib/users";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const currentUser = await getAuthenticatedUser();
    if (!currentUser) {
      return jsonError("Unauthorized", 401);
    }

    const { id } = await params;
    const targetUser = getUserById(id);
    if (!targetUser) {
      return jsonError("User not found", 404);
    }

    const isSelf = currentUser.id === id;
    const isCoordinator = currentUser.role === "COORDINATOR";
    if (!isSelf && !isCoordinator) {
      return jsonError("Forbidden", 403);
    }

    const body = await request.json();
    const parsed = userUpdateSchema.parse(body);
    if (parsed.role && !isCoordinator) {
      return jsonError("Only coordinators can change roles", 403);
    }

    const updated = updateUser(id, parsed);
    const { password, ...publicUser } = updated;
    void password;
    return NextResponse.json({ user: publicUser });
  } catch (error) {
    return handleRouteError(error);
  }
}
