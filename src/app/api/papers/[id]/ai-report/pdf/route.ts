import { NextResponse } from "next/server";
import { requireCoordinatorUser } from "@/lib/auth-helpers";
import { handleRouteError, jsonError } from "@/lib/api-route";
import { getLatestAiReportForPaper, getPaperById } from "@/lib/review-service";
import { buildFinalReportPdf } from "@/lib/pdf-report";

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: Params) {
  try {
    const { allowed, reason } = await requireCoordinatorUser();
    if (!allowed) {
      return jsonError(reason === "UNAUTHENTICATED" ? "Unauthorized" : "Forbidden", reason === "UNAUTHENTICATED" ? 401 : 403);
    }
    const { id } = await params;
    const paper = getPaperById(id);
    if (!paper) return jsonError("Paper not found", 404);

    const report = getLatestAiReportForPaper(id);
    if (!report) return jsonError("No AI report exists for this paper. Generate one first.", 404);

    const pdfBytes = await buildFinalReportPdf({
      paperId: paper.id,
      paperTitle: paper.title,
      consensusSummary: report.consensusSummary,
      agreedStrengths: report.agreedStrengths,
      agreedConcerns: report.agreedConcerns,
      divergences: report.divergences,
      overallRecommendation: report.overallRecommendation,
      reviewerCount: report.reviewerCount,
    });

    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="ai-report-${paper.id}.pdf"`,
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
