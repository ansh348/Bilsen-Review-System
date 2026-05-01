import Link from "next/link";
import { auth } from "@/auth";
import { getUserById } from "@/lib/users";
import { getReviewerLeaderboard } from "@/lib/review-service";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PeriodSelector } from "@/components/admin/period-selector";
import { AnalyticsExportButtons } from "@/components/admin/analytics-export-buttons";
import type { AnalyticsPeriod } from "@/lib/review-types";

interface AdminReviewersPageProps {
  searchParams: Promise<{ period?: string }>;
}

export default async function AdminReviewersPage({ searchParams }: AdminReviewersPageProps) {
  const session = await auth();
  if (!session?.user?.id) {
    return null;
  }

  const user = getUserById(session.user.id);
  if (!user || user.role !== "COORDINATOR") {
    return null;
  }

  const params = await searchParams;
  const period = (params.period ?? "overall") as AnalyticsPeriod;
  const leaderboard = getReviewerLeaderboard(period);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Reviewer Performance</h1>
        <p className="text-sm text-muted-foreground">
          Leaderboard and quality metrics for reviewers.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <PeriodSelector currentPeriod={period} />
        <AnalyticsExportButtons type="leaderboard" period={period} />
      </div>

      <Card className="border">
        <CardHeader>
          <CardTitle className="text-base">Leaderboard</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {leaderboard.length === 0 ? (
            <p className="text-sm text-muted-foreground">No reviewer metrics yet.</p>
          ) : (
            leaderboard.map((item, index) => (
              <div
                key={item.reviewer.id}
                className="rounded-md border border-border p-3 text-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <p className="font-medium">#{index + 1}</p>
                    <p className="font-medium">{item.reviewer.name}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{item.completedAssignments} done</Badge>
                    <Badge variant="outline">{item.acceptanceRate}% accept</Badge>
                    <Badge variant="outline">{item.onTimeRate}% on-time</Badge>
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/admin/reviewers/${item.reviewer.id}`}>Details</Link>
                    </Button>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-4 text-xs text-muted-foreground">
                  <span>Overall: {item.averageOverallRating}</span>
                  <span>Quality: {item.averageQuality}</span>
                  <span>Quantity: {item.averageQuantity}</span>
                  <span>Timeliness: {item.averageTimeliness}</span>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
