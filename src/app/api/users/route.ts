import { NextResponse } from "next/server";
import { requireCoordinatorUser } from "@/lib/auth-helpers";
import { handleRouteError, jsonError } from "@/lib/api-route";
import { listAllUsers } from "@/lib/users";

export async function GET() {
  try {
    const authz = await requireCoordinatorUser();
    if (!authz.allowed) {
      return jsonError(
        authz.reason === "UNAUTHENTICATED" ? "Unauthorized" : "Forbidden",
        authz.reason === "UNAUTHENTICATED" ? 401 : 403
      );
    }

    const users = listAllUsers().map((user) => {
      const { password, ...sanitized } = user;
      void password;
      return sanitized;
    });
    return NextResponse.json({ users });
  } catch (error) {
    return handleRouteError(error);
  }
}
