import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-helpers";
import {
  getUnreadNotificationCount,
  listNotificationsForUser,
} from "@/lib/review-service";
import { handleRouteError, jsonError } from "@/lib/api-route";

export async function GET() {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return jsonError("Unauthorized", 401);
    }

    const notifications = listNotificationsForUser(user.id);
    const unreadCount = getUnreadNotificationCount(user.id);
    return NextResponse.json({ notifications, unreadCount });
  } catch (error) {
    return handleRouteError(error);
  }
}
