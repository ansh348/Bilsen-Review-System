import { auth } from "@/auth";
import { getUserById } from "@/lib/users";

export async function getAuthenticatedUser() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return null;
  }

  return getUserById(userId) ?? null;
}

export async function requireCoordinatorUser() {
  const user = await getAuthenticatedUser();
  if (!user) {
    return { user: null, allowed: false, reason: "UNAUTHENTICATED" as const };
  }
  if (user.role !== "COORDINATOR") {
    return { user, allowed: false, reason: "FORBIDDEN" as const };
  }

  return { user, allowed: true, reason: null };
}
