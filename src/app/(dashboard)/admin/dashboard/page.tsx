import { auth } from "@/auth";
import { getUserById } from "@/lib/users";
import {
  getOverviewAnalytics,
  getWorkloadAnalytics,
} from "@/lib/review-service";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PeriodSelector } from "@/components/admin/period-selector";
import { RunRemindersButton } from "@/components/admin/run-reminders-button";
import type { AnalyticsPeriod } from "@/lib/review-types";

interface AdminDashboardPageProps {
  searchParams: Promise<{ period?: string }>;
}

export default async function AdminDashboardPage({ searchParams }: AdminDashboardPageProps) {
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
  const overview = getOverviewAnalytics();
  const workload = getWorkloadAnalytics(period);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Coordinator Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Overview of papers, reviews, and reviewer workload.
          </p>
        </div>
        <RunRemindersButton />
      </div>

      <PeriodSelector currentPeriod={period} />

      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
        <Card className="border">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">
              Total Papers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-semibold">{overview.totalPapers}</p>
          </CardContent>
        </Card>
        <Card className="border">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">
              Active Papers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-semibold">{overview.activePapers}</p>
          </CardContent>
        </Card>
        <Card className="border">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">
              Pending Reviews
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-semibold">{overview.pendingReviews}</p>
          </CardContent>
        </Card>
        <Card className={`border ${overview.overdueAssignments > 0 ? "border-red-500/50 bg-red-500/5" : ""}`}>
          <CardHeader className="pb-2">
            <CardTitle className={`text-xs uppercase tracking-wide ${overview.overdueAssignments > 0 ? "text-red-500" : "text-muted-foreground"}`}>
              Overdue
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-xl font-semibold ${overview.overdueAssignments > 0 ? "text-red-500" : ""}`}>{overview.overdueAssignments}</p>
          </CardContent>
        </Card>
        <Card className="border">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">
              Completed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-semibold">{overview.completedReviews}</p>
          </CardContent>
        </Card>
        <Card className="border">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">
              Upcoming
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-semibold">{overview.upcomingDeadlines}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border">
        <CardHeader>
          <CardTitle className="text-base">Reviewer Workload</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {workload.length === 0 ? (
            <p className="text-sm text-muted-foreground">No reviewer data.</p>
          ) : (
            workload.map((item) => (
              <div
                key={item.reviewerId}
                className="grid grid-cols-4 items-center gap-2 rounded-md border border-border p-3 text-sm"
              >
                <p className="font-medium">{item.name}</p>
                <p className="text-muted-foreground">
                  Active: {item.activeAssignments}
                </p>
                <p className="text-muted-foreground">
                  Completed: {item.completedAssignments}
                </p>
                <p className="text-muted-foreground">
                  Overdue: {item.overdueAssignments}
                </p>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
