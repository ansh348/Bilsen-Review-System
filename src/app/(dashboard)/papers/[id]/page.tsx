import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { canUserAccessPaper, getPaperDetails } from "@/lib/review-service";
import { getUserById, listAllUsers } from "@/lib/users";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PaperComplianceRunner } from "@/components/papers/paper-compliance-runner";
import { RateReviewForm } from "@/components/reviews/rate-review-form";
import { PaperStatusActions } from "@/components/papers/paper-status-actions";

function renderComplianceDetails(check: { checkType: string; details: Record<string, unknown> }) {
  const d = check.details;
  switch (check.checkType) {
    case "PAGE_LIMIT":
      if (d.pageCount === null) return "Page count not provided; check skipped.";
      return `Pages: ${d.pageCount}/${d.pageLimit}`;
    case "ABSTRACT_WORD_COUNT":
      return `Abstract: ${d.abstractWordCount}/${d.abstractWordLimit} words`;
    case "REQUIRED_SECTIONS":
      if (Array.isArray(d.missingSections) && d.missingSections.length > 0) {
        return `Missing: ${d.missingSections.join(", ")}`;
      }
      return "All required sections present";
    case "ANONYMITY_CHECK":
      if (Array.isArray(d.flags) && d.flags.length > 0) {
        return `Flags: ${d.flags.join(", ")}`;
      }
      return "No anonymity issues detected";
    case "METADATA_CHECK": {
      const parts: string[] = [];
      if (d.metadataAuthor) parts.push(`Author: ${d.metadataAuthor}`);
      if (d.metadataCompany) parts.push(`Company: ${d.metadataCompany}`);
      return parts.length > 0 ? parts.join(", ") : "Clean metadata";
    }
    case "REFERENCE_FORMAT": {
      if (d.note) return String(d.note);
      const parts: string[] = [`Expected: ${d.expectedFormat}`];
      if (d.detectedHint) parts.push(String(d.detectedHint));
      if (d.hasReferencesSection === false) parts.push("No references section found");
      return parts.join(" — ");
    }
    default:
      return null;
  }
}

interface PaperDetailsPageProps {
  params: Promise<{ id: string }>;
}

export default async function PaperDetailsPage({ params }: PaperDetailsPageProps) {
  const session = await auth();
  if (!session?.user?.id) {
    return null;
  }

  const currentUser = getUserById(session.user.id);
  if (!currentUser) {
    return null;
  }

  const { id } = await params;
  const details = getPaperDetails(id);
  if (!details) {
    notFound();
  }

  if (!canUserAccessPaper(details.paper.id, currentUser.id, currentUser.role)) {
    notFound();
  }

  const users = listAllUsers();

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{details.paper.title}</h1>
          <p className="text-sm text-muted-foreground">
            {details.venue?.name ?? "No venue"} | {details.paper.paperType ?? "N/A"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline">{details.paper.status}</Badge>
          {currentUser.role === "COORDINATOR" && (
            <>
              <PaperStatusActions
                paperId={details.paper.id}
                currentStatus={details.paper.status}
              />
              <Button variant="outline" asChild>
                <Link href={`/admin/papers/${details.paper.id}/assign`}>
                  Assign Reviewers
                </Link>
              </Button>
            </>
          )}
        </div>
      </div>

      <Card className="border">
        <CardHeader>
          <CardTitle className="text-base">Paper Metadata</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>
            <span className="text-muted-foreground">Authors: </span>
            {details.authors.map((author) => author.name).join(", ")}
          </p>
          <p>
            <span className="text-muted-foreground">PDF: </span>
            <a
              href={details.paper.pdfUrl}
              target="_blank"
              rel="noreferrer"
              className="text-primary underline-offset-2 hover:underline"
            >
              {details.paper.pdfUrl}
            </a>
          </p>
          {details.paper.overleafUrl && (
            <p>
              <span className="text-muted-foreground">Overleaf: </span>
              <a
                href={details.paper.overleafUrl}
                target="_blank"
                rel="noreferrer"
                className="text-primary underline-offset-2 hover:underline"
              >
                {details.paper.overleafUrl}
              </a>
            </p>
          )}
          <p className="text-muted-foreground">
            {details.paper.abstractText ?? "No abstract provided."}
          </p>
        </CardContent>
      </Card>

      <Card className="border">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Compliance Checks</CardTitle>
          <PaperComplianceRunner paperId={details.paper.id} />
        </CardHeader>
        <CardContent className="space-y-3">
          {details.complianceChecks.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No compliance checks have been run.
            </p>
          ) : (
            details.complianceChecks.map((check) => (
              <div
                key={check.id}
                className="flex items-center justify-between rounded-md border border-border p-3"
              >
                <div>
                  <p className="text-sm font-medium">{check.checkType}</p>
                  <p className="text-xs text-muted-foreground">
                    {check.checkedAt.slice(0, 10)}
                  </p>
                  {renderComplianceDetails(check) && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {renderComplianceDetails(check)}
                    </p>
                  )}
                </div>
                <Badge variant={check.passed ? "default" : "destructive"}>
                  {check.passed ? "Passed" : "Failed"}
                </Badge>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card className="border">
        <CardHeader>
          <CardTitle className="text-base">Review Rounds</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {details.rounds.length === 0 ? (
            <p className="text-sm text-muted-foreground">No rounds created yet.</p>
          ) : (
            details.rounds.map((roundData) => (
              <div key={roundData.round.id} className="rounded-md border border-border p-4">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-sm font-semibold">
                    Round {roundData.round.roundNumber}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Created {roundData.round.createdAt.slice(0, 10)}
                  </p>
                </div>
                <div className="space-y-2">
                  {roundData.assignments.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No assignments in this round.
                    </p>
                  ) : (
                    roundData.assignments.map((assignment) => {
                      const reviewer = users.find(
                        (user) => user.id === assignment.reviewerId
                      );
                      const canOpen =
                        assignment.reviewerId === currentUser.id ||
                        currentUser.role === "COORDINATOR";
                      return (
                        <div key={assignment.id} className="space-y-2">
                          <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border p-3">
                            <div>
                              <p className="text-sm font-medium">
                                {reviewer?.name ?? "Unknown reviewer"}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Due {assignment.deadline.slice(0, 10)}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline">{assignment.status}</Badge>
                              {canOpen && (
                                <Button variant="outline" size="sm" asChild>
                                  <Link href={`/reviews/${assignment.id}`}>Open</Link>
                                </Button>
                              )}
                            </div>
                          </div>
                          {assignment.status === "COMPLETED" &&
                            (currentUser.role === "COORDINATOR" ||
                              details.paper.authorIds.includes(currentUser.id)) &&
                            (() => {
                              const review = roundData.reviews.find(
                                (r) => r.assignmentId === assignment.id
                              );
                              if (!review) return null;
                              return (
                                <details>
                                  <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                                    Show Review
                                  </summary>
                                  <div className="mt-2 rounded-md border border-border/60 bg-muted/30 p-3 text-sm space-y-1">
                                    <div className="flex items-center gap-2">
                                      {review.recommendation && (
                                        <Badge variant="outline">{review.recommendation}</Badge>
                                      )}
                                      {review.overallScore != null && (
                                        <span className="text-xs text-muted-foreground">
                                          Score: {review.overallScore}/5
                                        </span>
                                      )}
                                    </div>
                                    <p className="whitespace-pre-wrap text-muted-foreground">
                                      {review.comments}
                                    </p>
                                  </div>
                                </details>
                              );
                            })()}
                          {assignment.status === "COMPLETED" &&
                            details.paper.authorIds.includes(currentUser.id) &&
                            (() => {
                              const review = roundData.reviews.find(
                                (r) => r.assignmentId === assignment.id
                              );
                              if (!review) return null;
                              return <RateReviewForm reviewId={review.id} />;
                            })()}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
