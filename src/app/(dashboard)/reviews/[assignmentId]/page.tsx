import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { getUserById } from "@/lib/users";
import { getAssignmentById } from "@/lib/review-service";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ReviewWorkspacePanel } from "@/components/reviews/review-workspace-panel";

interface ReviewWorkspacePageProps {
  params: Promise<{ assignmentId: string }>;
}

export default async function ReviewWorkspacePage({
  params,
}: ReviewWorkspacePageProps) {
  const session = await auth();
  if (!session?.user?.id) {
    return null;
  }

  const currentUser = getUserById(session.user.id);
  if (!currentUser) {
    return null;
  }

  const { assignmentId } = await params;
  const assignmentDetails = getAssignmentById(assignmentId);
  if (!assignmentDetails) {
    notFound();
  }

  const isOwner = assignmentDetails.assignment.reviewerId === currentUser.id;
  const isCoordinator = currentUser.role === "COORDINATOR";
  if (!isOwner && !isCoordinator) {
    notFound();
  }

  const review = assignmentDetails.review;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Review Workspace</h1>
          <p className="text-sm text-muted-foreground">
            {assignmentDetails.paper.title}
          </p>
        </div>
        <Badge variant="outline">{assignmentDetails.assignment.status}</Badge>
      </div>

      <Card className="border">
        <CardHeader>
          <CardTitle className="text-base">Assignment Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            <span className="text-muted-foreground">Round:</span>{" "}
            {assignmentDetails.round.roundNumber}
          </p>
          <p>
            <span className="text-muted-foreground">Deadline:</span>{" "}
            {assignmentDetails.assignment.deadline.slice(0, 10)}
          </p>
          <p>
            <span className="text-muted-foreground">Paper:</span>{" "}
            <Link
              href={`/papers/${assignmentDetails.paper.id}`}
              className="text-primary hover:underline"
            >
              Open paper detail
            </Link>
          </p>
          <p className="flex flex-wrap items-center gap-2">
            <span className="text-muted-foreground">PDF:</span>{" "}
            {assignmentDetails.paper.pdfUrl ? (
              <a
                href={assignmentDetails.paper.pdfUrl}
                target="_blank"
                rel="noreferrer"
                className="text-primary hover:underline"
              >
                Open PDF
              </a>
            ) : assignmentDetails.paper.pdfPath ? (
              <a
                href={`/api/papers/${assignmentDetails.paper.id}/pdf`}
                target="_blank"
                rel="noreferrer"
                className="text-primary hover:underline"
              >
                Open PDF
              </a>
            ) : (
              <span className="text-muted-foreground">Not available</span>
            )}
            {(assignmentDetails.paper.pdfUrl ||
              assignmentDetails.paper.pdfPath) && (
              <Button variant="outline" size="sm" asChild>
                <Link
                  href={`/papers/${assignmentDetails.paper.id}/view?assignmentId=${assignmentDetails.assignment.id}`}
                >
                  Open Annotated Viewer
                </Link>
              </Button>
            )}
          </p>
          {assignmentDetails.paper.overleafUrl && (
            <p>
              <span className="text-muted-foreground">Overleaf:</span>{" "}
              <a
                href={assignmentDetails.paper.overleafUrl}
                target="_blank"
                rel="noreferrer"
                className="text-primary hover:underline"
              >
                Open project
              </a>
            </p>
          )}
        </CardContent>
      </Card>

      {isOwner ? (
        <Card className="border">
          <CardHeader>
            <CardTitle className="text-base">Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <ReviewWorkspacePanel
              assignmentId={assignmentDetails.assignment.id}
              status={assignmentDetails.assignment.status}
              initialComments={review?.comments ?? ""}
              initialRecommendation={review?.recommendation ?? "MINOR_REVISION"}
              initialOverallScore={review?.overallScore ?? ""}
            />
          </CardContent>
        </Card>
      ) : (
        <Card className="border">
          <CardHeader>
            <CardTitle className="text-base">Review Snapshot</CardTitle>
          </CardHeader>
          <CardContent>
            {review ? (
              <div className="space-y-2">
                <p className="text-sm">
                  <span className="text-muted-foreground">Recommendation:</span>{" "}
                  {review.recommendation ?? "N/A"}
                </p>
                <p className="text-sm whitespace-pre-wrap">{review.comments}</p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Reviewer has not submitted yet.
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
