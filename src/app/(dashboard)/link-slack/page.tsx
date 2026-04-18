import { auth } from "@/auth";
import { getUserById } from "@/lib/users";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LinkSlackForm } from "@/components/profile/link-slack-form";

export default async function LinkSlackPage() {
  const session = await auth();
  if (!session?.user?.id) {
    return null;
  }

  const user = getUserById(session.user.id);
  if (!user) {
    return null;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Link Slack Account</h1>
        <p className="text-sm text-muted-foreground">
          Connect your Slack identity to receive assignment notifications.
        </p>
      </div>

      <Card className="border">
        <CardHeader>
          <CardTitle className="text-base">Slack Link</CardTitle>
        </CardHeader>
        <CardContent>
          <LinkSlackForm initialSlackId={user.slackId ?? ""} />
        </CardContent>
      </Card>
    </div>
  );
}
