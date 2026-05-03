import { auth } from "@/auth";
import { getUserById } from "@/lib/users";
import { listNotificationsForUser } from "@/lib/review-service";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ProfileForm } from "@/components/profile/profile-form";

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user?.id) {
    return null;
  }

  const user = getUserById(session.user.id);
  if (!user) {
    return null;
  }

  const notifications = listNotificationsForUser(user.id).slice(0, 10);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Profile</h1>
        <p className="text-sm text-muted-foreground">
          Manage account information and linked services.
        </p>
      </div>

      <Card className="border">
        <CardHeader>
          <CardTitle className="text-base">Account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm">
            <p>
              <span className="text-muted-foreground">Email:</span> {user.email}
            </p>
            <p>
              <span className="text-muted-foreground">Role:</span>{" "}
              <Badge variant="outline">{user.role}</Badge>
            </p>
            <p>
              <span className="text-muted-foreground">Slack:</span>{" "}
              {user.slackId ?? "Not linked"}
            </p>
          </div>
          <ProfileForm
            userId={user.id}
            initialName={user.name}
            initialExpertise={user.expertise ?? []}
            initialAffiliation={user.affiliation ?? null}
          />
        </CardContent>
      </Card>

      <Card className="border">
        <CardHeader>
          <CardTitle className="text-base">Recent Notifications</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {notifications.length === 0 ? (
            <p className="text-sm text-muted-foreground">No notifications.</p>
          ) : (
            notifications.map((notification) => (
              <div key={notification.id} className="rounded-md border border-border p-3">
                <p className="text-sm font-medium">{notification.title}</p>
                <p className="text-xs text-muted-foreground">{notification.message}</p>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
