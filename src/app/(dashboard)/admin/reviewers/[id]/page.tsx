import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { getUserById } from "@/lib/users";
import { getReviewerAnalytics } from "@/lib/review-service";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PeriodSelector } from "@/components/admin/period-selector";
import type { AnalyticsPeriod } from "@/lib/review-types";

interface ReviewerDetailsPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ period?: string }>;
}

export default async function ReviewerDetailsPage({
  params,
  searchParams,
}: ReviewerDetailsPageProps) {
  const session = await auth();
  if (!session?.user?.id) {
    return null;
  }

  const currentUser = getUserById(session.user.id);
  if (!currentUser || currentUser.role !== "COORDINATOR") {
    return null;
  }

  const { id } = await params;
  const sp = await searchParams;
  const period = (sp.period ?? "overall") as AnalyticsPeriod;
  const data = getReviewerAnalytics(id, period);
  if (!data) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{data.stats.reviewer.name}</h1>
          <p className="text-sm text-muted-foreground">{data.stats.reviewer.email}</p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/admin/reviewers">Back</Link>
        </Button>
      </div>

      <PeriodSelector currentPeriod={period} />

      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
        <Card className="border">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">
              Overall Avg
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{data.stats.averageOverallRating}</p>
          </CardContent>
        </Card>
        <Card className="border">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">
              Avg Quality
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{data.stats.averageQuality}</p>
          </CardContent>
        </Card>
        <Card className="border">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">
              Avg Quantity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{data.stats.averageQuantity}</p>
          </CardContent>
        </Card>
        <Card className="border">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">
              Avg Timeliness
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{data.stats.averageTimeliness}</p>
          </CardContent>
        </Card>
        <Card className="border">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">
              Acceptance Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{data.stats.acceptanceRate}%</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {data.stats.acceptedAssignments} accepted · {data.stats.declinedAssignments} declined
            </p>
          </CardContent>
        </Card>
        <Card className="border">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">
              On-time Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{data.stats.onTimeRate}%</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border">
        <CardHeader>
          <CardTitle className="text-base">Assignments</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {data.assignments.length === 0 ? (
            <p className="text-sm text-muted-foreground">No assignments.</p>
          ) : (
            data.assignments.map(({ assignment, paper }) => (
              <div
                key={assignment.id}
                className="flex items-center justify-between rounded-md border border-border p-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{paper.title}</p>
                  <p className="text-xs text-muted-foreground">
                    Due {assignment.deadline.slice(0, 10)}
                  </p>
                </div>
                <Badge variant="outline">{assignment.status}</Badge>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card className="border">
        <CardHeader>
          <CardTitle className="text-base">Ratings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {data.ratings.length === 0 ? (
            <p className="text-sm text-muted-foreground">No ratings yet.</p>
          ) : (
            data.ratings.map((rating) => (
              <div key={rating.id} className="rounded-md border border-border p-3">
                <p className="text-sm">
                  Quality {rating.qualityScore} | Quantity {rating.quantityScore} |
                  Timeliness {rating.timelinessScore}
                </p>
                {rating.comment && (
                  <p className="text-xs text-muted-foreground">{rating.comment}</p>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
