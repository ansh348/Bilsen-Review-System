import { NextResponse } from "next/server";
import { requireCoordinatorUser } from "@/lib/auth-helpers";
import { handleRouteError, jsonError } from "@/lib/api-route";
import {
  getReviewerLeaderboard,
  getWorkloadAnalytics,
} from "@/lib/review-service";
import { buildCsv } from "@/lib/csv";
import { buildAnalyticsPdf } from "@/lib/pdf-report";
import type { AnalyticsPeriod } from "@/lib/review-types";

const VALID_PERIODS: AnalyticsPeriod[] = ["monthly", "yearly", "overall"];

export async function GET(request: Request) {
  try {
    const { allowed, reason } = await requireCoordinatorUser();
    if (!allowed) {
      return jsonError(reason === "UNAUTHENTICATED" ? "Unauthorized" : "Forbidden", reason === "UNAUTHENTICATED" ? 401 : 403);
    }

    const url = new URL(request.url);
    const format = (url.searchParams.get("format") ?? "csv").toLowerCase();
    const type = (url.searchParams.get("type") ?? "leaderboard").toLowerCase();
    const periodParam = (url.searchParams.get("period") ?? "overall") as AnalyticsPeriod;
    const period = VALID_PERIODS.includes(periodParam) ? periodParam : "overall";

    if (format !== "csv" && format !== "pdf") {
      return jsonError("format must be csv or pdf", 400);
    }
    if (type !== "leaderboard" && type !== "workload") {
      return jsonError("type must be leaderboard or workload", 400);
    }

    let title: string;
    let headers: string[];
    let rows: Array<Array<string | number>>;

    if (type === "leaderboard") {
      const data = getReviewerLeaderboard(period);
      title = `Reviewer Leaderboard (${period})`;
      headers = [
        "Rank",
        "Reviewer",
        "Email",
        "Completed",
        "Active",
        "Overdue",
        "Acceptance %",
        "On-Time %",
        "Avg Quality",
        "Avg Quantity",
        "Avg Timeliness",
        "Avg Overall",
      ];
      rows = data.map((item, index) => [
        index + 1,
        item.reviewer.name,
        item.reviewer.email,
        item.completedAssignments,
        item.activeAssignments,
        item.overdueAssignments,
        item.acceptanceRate,
        item.onTimeRate,
        item.averageQuality,
        item.averageQuantity,
        item.averageTimeliness,
        item.averageOverallRating,
      ]);
    } else {
      const data = getWorkloadAnalytics(period);
      title = `Reviewer Workload (${period})`;
      headers = ["Reviewer", "Email", "Active", "Completed", "Overdue"];
      rows = data.map((item) => [
        item.name,
        item.email,
        item.activeAssignments,
        item.completedAssignments,
        item.overdueAssignments,
      ]);
    }

    const filenameBase = `${type}-${period}-${new Date().toISOString().slice(0, 10)}`;

    if (format === "csv") {
      const csv = buildCsv(headers, rows);
      return new NextResponse(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filenameBase}.csv"`,
        },
      });
    }

    const pdfBytes = await buildAnalyticsPdf(title, headers, rows);
    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filenameBase}.pdf"`,
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
