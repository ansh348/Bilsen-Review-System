import Link from "next/link";
import { auth } from "@/auth";
import { getUserById } from "@/lib/users";
import { listAssignmentsForReviewer } from "@/lib/review-service";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

function getDeadlineUrgency(deadline: string, status: string): string {
  if (status === "OVERDUE" || status === "COMPLETED" || status === "DECLINED") {
    return status === "OVERDUE" ? "text-red-500" : "text-muted-foreground";
  }
  const ms = new Date(deadline).getTime() - Date.now();
  if (ms < 0) return "text-red-500";
  if (ms <= 24 * 60 * 60 * 1000) return "text-orange-500";
  if (ms <= 3 * 24 * 60 * 60 * 1000) return "text-yellow-600 dark:text-yellow-500";
  return "text-muted-foreground";
}

function getDeadlineLabel(deadline: string, status: string): string {
  if (status === "COMPLETED" || status === "DECLINED") return `Due ${deadline.slice(0, 10)}`;
  if (status === "OVERDUE") return `Overdue — was due ${deadline.slice(0, 10)}`;
  const ms = new Date(deadline).getTime() - Date.now();
  if (ms < 0) return `Overdue — was due ${deadline.slice(0, 10)}`;
  if (ms <= 24 * 60 * 60 * 1000) return `Due tomorrow — ${deadline.slice(0, 10)}`;
  if (ms <= 3 * 24 * 60 * 60 * 1000) return `Due soon — ${deadline.slice(0, 10)}`;
  return `Due ${deadline.slice(0, 10)}`;
}

export default async function MyReviewsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    return null;
  }

  const currentUser = getUserById(session.user.id);
  if (!currentUser) {
    return null;
  }

  const assignments = listAssignmentsForReviewer(currentUser.id);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">My Review Assignments</h1>
        <p className="text-sm text-muted-foreground">
          Accept, track, and submit your assigned reviews.
        </p>
      </div>

      <Card className="border">
        <CardHeader>
          <CardTitle className="text-base">
            Assignments ({assignments.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {assignments.length === 0 ? (
            <p className="text-sm text-muted-foreground">No assignments yet.</p>
          ) : (
            assignments.map(({ assignment, paper, round, review }) => (
              <div
                key={assignment.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border p-4"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{paper.title}</p>
                  <p className={`text-xs ${getDeadlineUrgency(assignment.deadline, assignment.status)}`}>
                    Round {round.roundNumber} | {getDeadlineLabel(assignment.deadline, assignment.status)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {review && <Badge variant="default">Reviewed</Badge>}
                  <Badge variant={assignment.status === "OVERDUE" ? "destructive" : "outline"}>{assignment.status}</Badge>
                  <Button size="sm" variant="outline" asChild>
                    <Link href={`/reviews/${assignment.id}`}>Open</Link>
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
