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
import { detectConflicts } from "@/lib/coi-detection";

interface AssignReviewersPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ roundId?: string }>;
}

export default async function AssignReviewersPage({
  params,
  searchParams,
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
  const query = await searchParams;
  const details = getPaperDetails(id);
  if (!details) {
    notFound();
  }

  const users = listAllUsers();
  const workload = getWorkloadAnalytics();
  const workloadMap = new Map(
    workload.map((item) => [item.reviewerId, item.activeAssignments])
  );

  const priorReviewerIds = new Set<string>();
  for (const roundData of details.rounds) {
    for (const assignment of roundData.assignments) {
      priorReviewerIds.add(assignment.reviewerId);
    }
  }

  const reviewers = users
    .filter((user) => user.role === "MEMBER")
    .map((user) => {
      const conflicts = detectConflicts(details.paper, user);
      return {
        id: user.id,
        name: user.name,
        email: user.email,
        activeAssignments: workloadMap.get(user.id) ?? 0,
        priorReviewer: priorReviewerIds.has(user.id),
        coiReasons: conflicts.map((c) => c.detail),
      };
    });

  const priorRoundHistory = details.rounds.flatMap((roundData) =>
    roundData.assignments.map((assignment) => {
      const reviewer = users.find((user) => user.id === assignment.reviewerId);
      const review = roundData.reviews.find(
        (review) => review.assignmentId === assignment.id
      );
      return {
        key: assignment.id,
        roundNumber: roundData.round.roundNumber,
        reviewerName: reviewer?.name ?? "Unknown",
        status: assignment.status,
        recommendation: review?.recommendation ?? null,
      };
    })
  );
  const requestedRoundData = query.roundId
    ? details.rounds.find((roundData) => roundData.round.id === query.roundId) ?? null
    : null;
  const latestRoundData = details.rounds[details.rounds.length - 1] ?? null;
  const requiresNewRound =
    details.paper.status === "REVISION_REQUESTED" &&
    latestRoundData !== null &&
    latestRoundData.assignments.length > 0 &&
    requestedRoundData === null;
  const targetRoundData = requestedRoundData ?? latestRoundData;

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

      {priorRoundHistory.length > 0 && (
        <Card className="border">
          <CardHeader>
            <CardTitle className="text-base">Prior-round reviewers</CardTitle>
            <p className="text-xs text-muted-foreground">
              Consider picking new reviewers to avoid bias. Prior reviewers are flagged below.
            </p>
          </CardHeader>
          <CardContent>
            <div className="divide-y divide-border/60 text-sm">
              <div className="grid grid-cols-4 gap-2 px-2 pb-2 text-xs font-medium uppercase text-muted-foreground">
                <span>Round</span>
                <span>Reviewer</span>
                <span>Status</span>
                <span>Recommendation</span>
              </div>
              {priorRoundHistory.map((entry) => (
                <div
                  key={entry.key}
                  className="grid grid-cols-4 gap-2 px-2 py-2"
                >
                  <span className="text-muted-foreground">
                    Round {entry.roundNumber}
                  </span>
                  <span>{entry.reviewerName}</span>
                  <span>
                    <Badge variant="outline">{entry.status}</Badge>
                  </span>
                  <span className="text-muted-foreground">
                    {entry.recommendation ?? "N/A"}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border">
        <CardHeader>
          <CardTitle className="text-base">Assignment Batch</CardTitle>
        </CardHeader>
        <CardContent>
          {requiresNewRound ? (
            <p className="text-sm text-muted-foreground">
              This paper is waiting for a new review round. Start the next round from the paper page,
              then return here to assign reviewers.
            </p>
          ) : (
            <AssignReviewersForm
              paperId={details.paper.id}
              reviewers={reviewers}
              initialRoundId={targetRoundData?.round.id ?? null}
              roundLabel={
                targetRoundData
                  ? `Round ${targetRoundData.round.roundNumber}`
                  : "Round 1"
              }
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
