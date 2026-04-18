import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { getUserById, listAllUsers } from "@/lib/users";
import { getPaperDetails, getWorkloadAnalytics } from "@/lib/review-service";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AssignReviewersForm } from "@/components/admin/assign-reviewers-form";
import { ExtensionDecisionForm } from "@/components/admin/extension-decision-form";

interface AssignReviewersPageProps {
  params: Promise<{ id: string }>;
}

export default async function AssignReviewersPage({
  params,
}: AssignReviewersPageProps) {
  const session = await auth();
  if (!session?.user?.id) {
    return null;
  }

  const currentUser = getUserById(session.user.id);
  if (!currentUser || currentUser.role !== "COORDINATOR") {
    return null;
  }

  const { id } = await params;
  const details = getPaperDetails(id);
  if (!details) {
    notFound();
  }

  const users = listAllUsers();
  const workload = getWorkloadAnalytics();
  const workloadMap = new Map(
    workload.map((item) => [item.reviewerId, item.activeAssignments])
  );
  const reviewers = users
    .filter((user) => user.role === "MEMBER")
    .map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      activeAssignments: workloadMap.get(user.id) ?? 0,
    }));

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Assign Reviewers</h1>
          <p className="text-sm text-muted-foreground">{details.paper.title}</p>
        </div>
        <Button variant="outline" asChild>
          <Link href={`/papers/${details.paper.id}`}>Back to paper</Link>
        </Button>
      </div>

      <Card className="border">
        <CardHeader>
          <CardTitle className="text-base">Current Rounds</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {details.rounds.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No rounds yet. Assigning reviewers will create round 1.
            </p>
          ) : (
            details.rounds.map((roundData) => (
              <div
                key={roundData.round.id}
                className="rounded-md border border-border p-3"
              >
                <p className="text-sm font-medium">
                  Round {roundData.round.roundNumber}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {roundData.assignments.length === 0 ? (
                    <span className="text-xs text-muted-foreground">
                      No assignments
                    </span>
                  ) : (
                    roundData.assignments.map((assignment) => {
                      const reviewer = users.find(
                        (user) => user.id === assignment.reviewerId
                      );
                      return (
                        <Badge key={assignment.id} variant="outline">
                          {reviewer?.name ?? "Unknown"} ({assignment.status})
                        </Badge>
                      );
                    })
                  )}
                </div>
                {roundData.assignments
                  .filter(
                    (assignment) => assignment.status === "EXTENSION_REQUESTED"
                  )
                  .map((assignment) => {
                    const reviewer = users.find(
                      (user) => user.id === assignment.reviewerId
                    );
                    return (
                      <div
                        key={`${assignment.id}-extension`}
                        className="mt-3 rounded-md border border-border p-3"
                      >
                        <p className="mb-2 text-xs text-muted-foreground">
                          Extension request from {reviewer?.name ?? "reviewer"} to{" "}
                          {assignment.extensionRequestedTo?.slice(0, 10)}
                        </p>
                        <ExtensionDecisionForm
                          assignmentId={assignment.id}
                          requestedDate={assignment.extensionRequestedTo}
                        />
                      </div>
                    );
                  })}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card className="border">
        <CardHeader>
          <CardTitle className="text-base">New Assignment Batch</CardTitle>
        </CardHeader>
        <CardContent>
          <AssignReviewersForm paperId={details.paper.id} reviewers={reviewers} />
        </CardContent>
      </Card>
    </div>
  );
}
