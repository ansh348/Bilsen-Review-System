import Link from "next/link";
import { listPapers, listVenues } from "@/lib/review-service";
import { auth } from "@/auth";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface PapersPageProps {
  searchParams: Promise<{
    status?: string;
    venueId?: string;
  }>;
}

export default async function PapersPage({ searchParams }: PapersPageProps) {
  const session = await auth();
  if (!session?.user?.id) {
    return null;
  }

  const isCoordinator = session.user.role === "COORDINATOR";
  const params = await searchParams;
  const papers = listPapers({
    status: params.status ?? null,
    venueId: params.venueId ?? null,
    authorId: isCoordinator ? null : session.user.id,
  });
  const venues = listVenues();

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
            {isCoordinator ? "Papers" : "My Papers"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isCoordinator
              ? "Browse submissions and their review progress."
              : "Browse your submissions and their review progress."}
          </p>
        </div>
        <Button asChild>
          <Link href="/papers/new">Submit Paper</Link>
        </Button>
      </div>

      <Card className="border">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <label className="text-xs uppercase tracking-wide text-muted-foreground">
                Status
              </label>
              <select
                name="status"
                defaultValue={params.status ?? ""}
                className="h-9 w-full rounded-lg border border-input/90 bg-input/55 px-3 text-sm text-foreground shadow-[0_1px_0_rgba(255,255,255,0.03)_inset] transition-[border-color,box-shadow,background-color] outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/35"
              >
                <option value="">All</option>
                <option value="SUBMITTED">Submitted</option>
                <option value="UNDER_REVIEW">Under Review</option>
                <option value="REVISION_REQUESTED">Revision Requested</option>
                <option value="ACCEPTED">Accepted</option>
                <option value="REJECTED">Rejected</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs uppercase tracking-wide text-muted-foreground">
                Venue
              </label>
              <select
                name="venueId"
                defaultValue={params.venueId ?? ""}
                className="h-9 w-full rounded-lg border border-input/90 bg-input/55 px-3 text-sm text-foreground shadow-[0_1px_0_rgba(255,255,255,0.03)_inset] transition-[border-color,box-shadow,background-color] outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/35"
              >
                <option value="">All venues</option>
                {venues.map((venue) => (
                  <option key={venue.id} value={venue.id}>
                    {venue.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end gap-2">
              <Button type="submit">Apply</Button>
              <Button variant="outline" asChild>
                <Link href="/papers">Reset</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="border">
        <CardHeader>
          <CardTitle className="text-base">All Papers ({papers.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {papers.length === 0 ? (
            <p className="text-sm text-muted-foreground">No papers found.</p>
          ) : (
            papers.map(({ paper, venue, authors, latestRoundNumber, pendingAssignments, complianceSummary }) => (
              <Link
                key={paper.id}
                href={`/papers/${paper.id}`}
                className="flex flex-col gap-2 rounded-md border border-border p-4 hover:bg-accent/30"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-foreground">{paper.title}</p>
                  <div className="flex items-center gap-2">
                    {complianceSummary && (
                      <Badge variant={complianceSummary.passed === complianceSummary.total ? "default" : "destructive"}>
                        {complianceSummary.passed}/{complianceSummary.total} checks
                      </Badge>
                    )}
                    <Badge variant="outline">{paper.status}</Badge>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  <span>{venue?.name ?? "No venue selected"}</span>
                  <span>{authors.map((author) => author.name).join(", ")}</span>
                  <span>Round {latestRoundNumber || 0}</span>
                  <span>{pendingAssignments} pending assignments</span>
                </div>
              </Link>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
