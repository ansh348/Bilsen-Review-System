import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-helpers";
import { handleRouteError, jsonError } from "@/lib/api-route";
import { canUserAccessPaper, getPaperById } from "@/lib/review-service";
import { generateReviewWithClaude } from "@/lib/ai";
import { buildAnnotatedPdf } from "@/lib/pdf-report";
import { loadPdfBuffer } from "@/lib/pdf-metadata";

interface Params {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, { params }: Params) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return jsonError("Unauthorized", 401);
    const { id } = await params;
    const paper = getPaperById(id);
    if (!paper) return jsonError("Paper not found", 404);
    if (!canUserAccessPaper(paper.id, user.id, user.role)) return jsonError("Forbidden", 403);

    if (!process.env.ANTHROPIC_API_KEY) {
      return jsonError("ANTHROPIC_API_KEY is not configured", 500);
    }

    const body = (await request.json().catch(() => ({}))) as { extractedText?: string };
    const extractedText = body.extractedText?.trim();
    if (!extractedText || extractedText.length < 20) {
      return jsonError("extractedText (>= 20 chars) is required to ground annotations", 400);
    }

    const pdfBytes = await loadPdfBuffer(paper);
    if (!pdfBytes) {
      return jsonError("Original PDF could not be fetched", 400);
    }

    const review = await generateReviewWithClaude(extractedText);

    const annotations = [
      ...review.strengths.map((s) => ({
        label: s.unsupported ? "STRENGTH (unsupported claim)" : "STRENGTH",
        text: s.point + (s.quote ? `\nQuote: ${s.quote}` : ""),
        page: 1,
      })),
      ...review.concerns.map((c) => ({
        label: c.unsupported ? "CONCERN (unsupported claim)" : "CONCERN",
        text: c.point + (c.quote ? `\nQuote: ${c.quote}` : ""),
        page: 1,
      })),
    ];

    const annotated = await buildAnnotatedPdf(pdfBytes, annotations);
    return new NextResponse(Buffer.from(annotated), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="annotated-${paper.id}.pdf"`,
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
