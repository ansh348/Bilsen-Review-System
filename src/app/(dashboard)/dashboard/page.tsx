import { auth } from "@/auth";
import Link from "next/link";
import {
  listAssignmentsForReviewer,
  listNotificationsForUser,
  listPapers,
} from "@/lib/review-service";
import { getUserById } from "@/lib/users";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RecentNotifications } from "@/components/dashboard/recent-notifications";

function getDeadlineUrgency(deadline: string, status: string): string {
  if (status === "OVERDUE") return "text-red-500";
  const ms = new Date(deadline).getTime() - Date.now();
  if (ms < 0) return "text-red-500";
  if (ms <= 24 * 60 * 60 * 1000) return "text-orange-500";
  if (ms <= 3 * 24 * 60 * 60 * 1000) return "text-yellow-600 dark:text-yellow-500";
  return "text-muted-foreground";
}

function getDeadlineLabel(deadline: string, status: string): string {
  if (status === "OVERDUE") return `Overdue — was due ${deadline.slice(0, 10)}`;
  const ms = new Date(deadline).getTime() - Date.now();
  if (ms < 0) return `Overdue — was due ${deadline.slice(0, 10)}`;
  if (ms <= 24 * 60 * 60 * 1000) return `Due tomorrow — ${deadline.slice(0, 10)}`;
  if (ms <= 3 * 24 * 60 * 60 * 1000) return `Due soon — ${deadline.slice(0, 10)}`;
  return `Due ${deadline.slice(0, 10)}`;
}

export default async function DashboardPage() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return null;
  }

  const currentUser = getUserById(userId);
  if (!currentUser) {
    return null;
  }

  const firstName = currentUser.name.split(" ")[0] ?? "User";
  const myAssignments = listAssignmentsForReviewer(userId);
  const pendingAssignments = myAssignments.filter(
    ({ assignment }) =>
      assignment.status !== "DECLINED" && assignment.status !== "COMPLETED"
  );
  const myPapers = listPapers({ authorId: userId });
  const notifications = listNotificationsForUser(userId).slice(0, 5);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">
          Welcome back, {firstName}
        </h1>
        <p className="text-sm text-muted-foreground">
          Here&apos;s what&apos;s happening with your papers and reviews.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">
              My Papers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{myPapers.length}</p>
          </CardContent>
        </Card>
        <Card className="border">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">
              Pending Reviews
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{pendingAssignments.length}</p>
          </CardContent>
        </Card>
        <Card className="border">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">
              Completed Reviews
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">
              {
                myAssignments.filter(
                  ({ assignment }) => assignment.status === "COMPLETED"
                ).length
              }
            </p>
          </CardContent>
        </Card>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border">
          <CardHeader>
            <CardTitle className="text-base">Pending Reviews</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {pendingAssignments.length === 0 ? (
              <p className="text-sm text-muted-foreground">No pending reviews.</p>
            ) : (
              pendingAssignments.slice(0, 5).map(({ assignment, paper }) => (
                <Link
                  key={assignment.id}
                  href={`/reviews/${assignment.id}`}
                  className="flex items-center justify-between rounded-md border border-border p-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{paper.title}</p>
                    <p className={`text-xs ${getDeadlineUrgency(assignment.deadline, assignment.status)}`}>
                      {getDeadlineLabel(assignment.deadline, assignment.status)}
                    </p>
                  </div>
                  <Badge variant={assignment.status === "OVERDUE" ? "destructive" : "outline"}>
                    {assignment.status}
                  </Badge>
                </Link>
              ))
            )}
          </CardContent>
        </Card>
        <Card className="border">
          <CardHeader>
            <CardTitle className="text-base">Recent Papers</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {myPapers.length === 0 ? (
              <p className="text-sm text-muted-foreground">No papers submitted yet.</p>
            ) : (
              myPapers.slice(0, 5).map(({ paper, venue }) => (
                <Link
                  key={paper.id}
                  href={`/papers/${paper.id}`}
                  className="flex items-center justify-between rounded-md border border-border p-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{paper.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {venue?.name ?? "No venue selected"}
                    </p>
                  </div>
                  <Badge variant="outline">{paper.status}</Badge>
                </Link>
              ))
            )}
          </CardContent>
        </Card>
      </div>
      <RecentNotifications notifications={notifications} />
    </div>
  );
}
