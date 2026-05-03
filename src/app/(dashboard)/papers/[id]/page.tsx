import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { canUserAccessPaper, getLatestAiReportForPaper, getPaperDetails } from "@/lib/review-service";
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
import { AiReportActions } from "@/components/papers/ai-report-actions";
import { CommentActionItemsPanel } from "@/components/papers/comment-action-items-panel";
import { listAnnotationsForPaper } from "@/lib/annotation-service";
import { listCommentActionItemsForPaper } from "@/lib/comment-action-service";
import { VenueSubmissionCard } from "@/components/papers/venue-submission-card";
import {
  AiComplianceDetails,
  AiReferenceDetails,
} from "@/components/papers/ai-compliance-details";
import { StackedBar, StatTile } from "@/components/papers/compliance-stats";
import { listVenues } from "@/lib/review-service";

function renderComplianceMessage(check: { details: Record<string, unknown> }): string | null {
  const m = check.details?.message;
  return typeof m === "string" && m.length > 0 ? m : null;
}

function renderComplianceTechnical(check: { checkType: string; details: Record<string, unknown> }) {
  const d = check.details;
  switch (check.checkType) {
    case "PAGE_LIMIT":
      if (d.pageCount === null || d.pageCount === undefined) return null;
      return `Pages: ${d.pageCount}/${d.pageLimit ?? "—"}`;
    case "ABSTRACT_WORD_COUNT":
      return `Abstract: ${d.abstractWordCount}/${d.abstractWordLimit ?? "—"} words`;
    case "REQUIRED_SECTIONS": {
      const parts: string[] = [];
      if (Array.isArray(d.missingSections) && d.missingSections.length > 0) {
        parts.push(`Missing: ${(d.missingSections as string[]).join(", ")}`);
      }
      if (Array.isArray(d.warnings) && d.warnings.length > 0) {
        parts.push(`Suggested: ${(d.warnings as string[]).join(", ")}`);
      }
      if (typeof d.source === "string") {
        parts.push(`source: ${d.source}`);
      }
      return parts.join(" · ") || null;
    }
    case "DESK_REJECT_RISK": {
      const items = Array.isArray(d.items)
        ? (d.items as Array<{ criterion: string; status: string; kind: string }>)
        : [];
      if (items.length === 0) return null;
      const failed = items.filter((i) => i.kind === "auto" && i.status === "fail");
      const manual = items.filter((i) => i.kind === "manual");
      const parts: string[] = [];
      if (failed.length > 0) parts.push(`Auto-fail: ${failed.map((i) => i.criterion).join("; ")}`);
      if (manual.length > 0) parts.push(`Manual: ${manual.length} item${manual.length === 1 ? "" : "s"}`);
      return parts.join(" · ") || null;
    }
    case "ANONYMITY_CHECK":
      if (Array.isArray(d.flags) && d.flags.length > 0) {
        return `Flags: ${(d.flags as string[]).join(", ")}`;
      }
      return null;
    case "METADATA_CHECK": {
      const parts: string[] = [];
      if (d.metadataAuthor) parts.push(`Author: ${d.metadataAuthor}`);
      if (d.metadataCompany) parts.push(`Company: ${d.metadataCompany}`);
      return parts.length > 0 ? parts.join(", ") : null;
    }
    case "REFERENCE_FORMAT": {
      const parts: string[] = [`Expected: ${d.expectedFormat}`];
      if (d.detectedHint) parts.push(String(d.detectedHint));
      if (typeof d.source === "string") parts.push(`source: ${d.source}`);
      return parts.join(" · ");
    }
    case "PDF_METADATA_ANONYMITY":
      if (Array.isArray(d.flags) && d.flags.length > 0) {
        return `PDF metadata: ${(d.flags as string[]).join(", ")}`;
      }
      return null;
    case "TOOL_LINK_ANONYMITY": {
      const links = Array.isArray(d.suspectLinks) ? (d.suspectLinks as Array<{ url: string; reason: string }>) : [];
      if (links.length === 0) return null;
      return `Suspect links: ${links.slice(0, 3).map((l) => l.url).join(", ")}${links.length > 3 ? "…" : ""}`;
    }
    case "DYNAMIC_CHECKLIST": {
      const missing = Array.isArray(d.missing) ? (d.missing as string[]) : [];
      return missing.length > 0 ? `Missing items: ${missing.join(", ")}` : null;
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
  const latestRound = details.rounds[details.rounds.length - 1];
  const isAuthor = details.paper.authorIds.includes(currentUser.id);
  const canManagePaper = currentUser.role === "COORDINATOR" || isAuthor;
  const latestAiReport =
    currentUser.role === "COORDINATOR" ? getLatestAiReportForPaper(details.paper.id) : null;

  const showVenueCard = isAuthor || currentUser.role === "COORDINATOR";
  const isSubmittedToVenue = details.paper.status === "SUBMITTED_TO_VENUE";
  const submittedVenueName = details.paper.submittedVenueId
    ? listVenues().find((v) => v.id === details.paper.submittedVenueId)?.name ?? null
    : null;
  const latestChecksByType = new Map<string, { passed: boolean; type: string }>();
  for (const check of details.complianceChecks) {
    const existing = latestChecksByType.get(check.checkType);
    if (!existing) {
      latestChecksByType.set(check.checkType, { passed: check.passed, type: check.checkType });
    }
  }
  const failedComplianceTypes = Array.from(latestChecksByType.values())
    .filter((c) => !c.passed)
    .map((c) => c.type);
  const complianceAllPassed =
    details.complianceChecks.length > 0 && failedComplianceTypes.length === 0;
  const showRevisionBanner =
    details.paper.status === "REVISION_REQUESTED" && (isAuthor || currentUser.role === "COORDINATOR");

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
          {canManagePaper && (
            <Button variant="outline" asChild>
              <Link href={`/papers/${details.paper.id}/edit`}>Edit Paper</Link>
            </Button>
          )}
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

      {showRevisionBanner && (
        <div className="rounded-lg border border-amber-500/50 bg-amber-500/5 p-4">
          <p className="text-sm font-semibold text-amber-600">
            Revision requested
          </p>
          <p className="mt-1 text-sm text-foreground">
            {latestRound?.round.revisionNote
              ? latestRound.round.revisionNote
              : "The coordinator asked for revisions. Review the reviewer feedback below and update your paper."}
          </p>
          {isAuthor && (
            <p className="mt-2 text-xs text-muted-foreground">
              Use the Edit Paper button above to update the PDF link or Overleaf URL.
            </p>
          )}
        </div>
      )}

      <Card className="border">
        <CardHeader>
          <CardTitle className="text-base">Paper Metadata</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>
            <span className="text-muted-foreground">Authors: </span>
            {details.authors.map((author) => author.name).join(", ")}
          </p>
          <p className="flex flex-wrap items-center gap-2">
            <span className="text-muted-foreground">PDF: </span>
            {details.paper.pdfUrl ? (
              <a
                href={details.paper.pdfUrl}
                target="_blank"
                rel="noreferrer"
                className="text-primary underline-offset-2 hover:underline"
              >
                {details.paper.pdfUrl}
              </a>
            ) : details.paper.pdfPath ? (
              <a
                href={`/api/papers/${details.paper.id}/pdf`}
                target="_blank"
                rel="noreferrer"
                className="text-primary underline-offset-2 hover:underline"
              >
                Uploaded PDF
              </a>
            ) : (
              <span className="text-muted-foreground">Not available</span>
            )}
            {(details.paper.pdfUrl || details.paper.pdfPath) && (
              <Button variant="outline" size="sm" asChild>
                <Link href={`/papers/${details.paper.id}/view`}>
                  Open Viewer
                </Link>
              </Button>
            )}
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

      {details.versions.length > 0 && (
        <Card className="border">
          <CardHeader>
            <CardTitle className="text-base">Version History</CardTitle>
            <p className="text-xs text-muted-foreground">
              Earlier PDFs from prior revision rounds. The current version is shown above.
            </p>
          </CardHeader>
          <CardContent className="space-y-2">
            {details.versions.map((version) => (
              <div
                key={version.id}
                className="flex items-center justify-between rounded-md border border-border p-3 text-sm"
              >
                <div className="space-y-1">
                  <p className="font-medium">
                    Version {version.versionNumber}
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      ({version.reason === "REVISION" ? "revision" : "re-upload"})
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Superseded {version.supersededAt.slice(0, 10)} ·{" "}
                    {version.title}
                  </p>
                </div>
                {(version.pdfPath || version.pdfUrl) ? (
                  <Button variant="outline" size="sm" asChild>
                    <a
                      href={`/api/papers/${details.paper.id}/versions/${version.id}/pdf`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Download PDF
                    </a>
                  </Button>
                ) : (
                  <span className="text-xs text-muted-foreground">No PDF</span>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {(() => {
        const ruleBasedChecks = details.complianceChecks.filter(
          (c) => c.checkType !== "AI_FULL_REVIEW" && c.checkType !== "AI_REFERENCE_CHECK",
        );
        const aiReviewChecks = details.complianceChecks.filter(
          (c) => c.checkType === "AI_FULL_REVIEW",
        );
        const citationsChecks = details.complianceChecks.filter(
          (c) => c.checkType === "AI_REFERENCE_CHECK",
        );
        const latestAiReview = aiReviewChecks
          .slice()
          .sort((a, b) => b.checkedAt.localeCompare(a.checkedAt))[0];
        const latestCitations = citationsChecks
          .slice()
          .sort((a, b) => b.checkedAt.localeCompare(a.checkedAt))[0];
        const hasAiKey = Boolean(process.env.ANTHROPIC_API_KEY);

        return (
          <>
            <Card className="border">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">Compliance Checks</CardTitle>
                <PaperComplianceRunner
                  paperId={details.paper.id}
                  hasAiKey={hasAiKey}
                  show="fast"
                />
              </CardHeader>
              <CardContent className="space-y-4">
                {ruleBasedChecks.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No compliance checks have been run.
                  </p>
                ) : (
                  <>
                    {(() => {
                      const passed = ruleBasedChecks.filter((c) => c.passed).length;
                      const failed = ruleBasedChecks.length - passed;
                      return (
                        <div className="space-y-2">
                          <div className="grid grid-cols-3 gap-2">
                            <StatTile label="Total" value={ruleBasedChecks.length} tone="muted" />
                            <StatTile label="Passed" value={passed} tone="emerald" />
                            <StatTile label="Failed" value={failed} tone="red" />
                          </div>
                          <StackedBar
                            segments={[
                              { value: passed, className: "bg-emerald-500", label: "Passed" },
                              { value: failed, className: "bg-destructive", label: "Failed" },
                            ]}
                          />
                        </div>
                      );
                    })()}
                    {ruleBasedChecks.map((check) => {
                      const message = renderComplianceMessage(check);
                      const technical = renderComplianceTechnical(check);
                      return (
                        <div
                          key={check.id}
                          className="rounded-md border border-border p-3"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-baseline gap-2">
                                <p className="text-sm font-medium">{check.checkType}</p>
                                <p className="text-xs text-muted-foreground">
                                  {check.checkedAt.slice(0, 10)}
                                </p>
                              </div>
                              {message && (
                                <p className={`text-sm leading-relaxed mt-1 ${check.passed ? "text-muted-foreground" : "text-foreground"}`}>
                                  {message}
                                </p>
                              )}
                              {technical && (
                                <p className="text-xs text-muted-foreground mt-1">{technical}</p>
                              )}
                            </div>
                            <Badge variant={check.passed ? "default" : "destructive"} className="shrink-0">
                              {check.passed ? "Passed" : "Failed"}
                            </Badge>
                          </div>
                        </div>
                      );
                    })}
                  </>
                )}
              </CardContent>
            </Card>

            <Card className="border">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">AI Review</CardTitle>
                <PaperComplianceRunner
                  paperId={details.paper.id}
                  hasAiKey={hasAiKey}
                  show="ai"
                />
              </CardHeader>
              <CardContent className="space-y-3">
                {!latestAiReview ? (
                  <p className="text-sm text-muted-foreground">
                    No AI review has been run yet.
                  </p>
                ) : (
                  <div className="rounded-md border border-border p-3">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-muted-foreground">
                          Run on {latestAiReview.checkedAt.slice(0, 10)}
                        </p>
                        {renderComplianceMessage(latestAiReview) && (
                          <p className={`text-sm leading-relaxed mt-1 ${latestAiReview.passed ? "text-muted-foreground" : "text-foreground"}`}>
                            {renderComplianceMessage(latestAiReview)}
                          </p>
                        )}
                      </div>
                      <Badge variant={latestAiReview.passed ? "default" : "destructive"} className="shrink-0">
                        {latestAiReview.passed ? "Passed" : "Failed"}
                      </Badge>
                    </div>
                    <div className="mt-3 border-t border-border/60 pt-3">
                      <AiComplianceDetails
                        details={latestAiReview.details as Parameters<typeof AiComplianceDetails>[0]["details"]}
                      />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">Citations Check</CardTitle>
                <PaperComplianceRunner
                  paperId={details.paper.id}
                  hasAiKey={hasAiKey}
                  show="ai"
                />
              </CardHeader>
              <CardContent className="space-y-3">
                {!latestCitations ? (
                  <p className="text-sm text-muted-foreground">
                    No citations check has been run yet.
                  </p>
                ) : (
                  <div className="rounded-md border border-border p-3">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-muted-foreground">
                          Run on {latestCitations.checkedAt.slice(0, 10)}
                        </p>
                        {renderComplianceMessage(latestCitations) && (
                          <p className={`text-sm leading-relaxed mt-1 ${latestCitations.passed ? "text-muted-foreground" : "text-foreground"}`}>
                            {renderComplianceMessage(latestCitations)}
                          </p>
                        )}
                      </div>
                      <Badge variant={latestCitations.passed ? "default" : "destructive"} className="shrink-0">
                        {latestCitations.passed ? "Passed" : "Failed"}
                      </Badge>
                    </div>
                    <div className="mt-3 border-t border-border/60 pt-3">
                      <AiReferenceDetails
                        details={latestCitations.details as Parameters<typeof AiReferenceDetails>[0]["details"]}
                      />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        );
      })()}

      {showVenueCard && (
        <Card className="border">
          <CardHeader>
            <CardTitle className="text-base">Venue Submission</CardTitle>
          </CardHeader>
          <CardContent>
            <VenueSubmissionCard
              paperId={details.paper.id}
              currentVenueId={details.paper.venueId}
              isSubmitted={isSubmittedToVenue}
              submittedVenueName={submittedVenueName}
              complianceAllPassed={complianceAllPassed}
              failedComplianceTypes={failedComplianceTypes}
            />
          </CardContent>
        </Card>
      )}

      {currentUser.role === "COORDINATOR" && (
        <Card className="border">
          <CardHeader>
            <CardTitle className="text-base">AI Synthesis Report</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {latestAiReport ? (
              <div className="space-y-2 text-sm">
                <p>
                  <span className="text-muted-foreground">Generated: </span>
                  {latestAiReport.createdAt.slice(0, 19).replace("T", " ")}
                </p>
                <p>
                  <span className="text-muted-foreground">Recommendation: </span>
                  <Badge variant="outline">{latestAiReport.overallRecommendation}</Badge>
                </p>
                <p className="text-muted-foreground">
                  {latestAiReport.consensusSummary || "No consensus summary."}
                </p>
                {latestAiReport.agreedConcerns.length > 0 && (
                  <div>
                    <p className="font-medium text-xs uppercase tracking-wide text-muted-foreground">
                      Agreed concerns
                    </p>
                    <ul className="ml-4 list-disc text-sm">
                      {latestAiReport.agreedConcerns.slice(0, 3).map((c, i) => (
                        <li key={i}>{c}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No AI synthesis report yet. Generate one once at least one review is submitted.
              </p>
            )}
            <AiReportActions
              paperId={details.paper.id}
              hasExistingReport={Boolean(latestAiReport)}
            />
          </CardContent>
        </Card>
      )}

      <Card className="border">
        <CardHeader>
          <CardTitle className="text-base">Reviewer Action Items</CardTitle>
        </CardHeader>
        <CardContent>
          <CommentActionItemsPanel
            paperId={details.paper.id}
            initialItems={listCommentActionItemsForPaper(details.paper.id)}
            hasComments={
              listAnnotationsForPaper(
                details.paper.id,
                currentUser.id,
                currentUser.role,
                { kind: "COMMENT" }
              ).length > 0
            }
          />
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
