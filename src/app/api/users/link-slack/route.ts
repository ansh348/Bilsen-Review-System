import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-helpers";
import { handleRouteError, jsonError } from "@/lib/api-route";
import { linkSlackSchema } from "@/lib/validations/review";
import { linkSlackAccount } from "@/lib/users";

export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return jsonError("Unauthorized", 401);
    }

    const body = await request.json();
    const parsed = linkSlackSchema.parse(body);
    const updatedUser = linkSlackAccount(user.id, parsed.slackId);
    const { password, ...publicUser } = updatedUser;
    void password;
    return NextResponse.json({ user: publicUser });
  } catch (error) {
    return handleRouteError(error);
  }
}
