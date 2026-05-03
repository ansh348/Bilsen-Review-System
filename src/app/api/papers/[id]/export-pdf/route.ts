import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-helpers";
import { handleRouteError, jsonError } from "@/lib/api-route";
import { canUserAccessPaper, getPaperById } from "@/lib/review-service";
import { listAnnotationsForPaper } from "@/lib/annotation-service";
import { listAllUsers } from "@/lib/users";
import { loadPdfBuffer } from "@/lib/pdf-metadata";
import { buildExportPdf } from "@/lib/pdf-export";

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(_: Request, { params }: Params) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return jsonError("Unauthorized", 401);

    const { id } = await params;
    const paper = getPaperById(id);
    if (!paper) return jsonError("Paper not found", 404);
    if (!canUserAccessPaper(paper.id, user.id, user.role)) {
      return jsonError("Forbidden", 403);
    }

    const pdfBytes = await loadPdfBuffer(paper);
    if (!pdfBytes) {
      return jsonError("Original PDF could not be fetched", 404);
    }

    const annotations = listAnnotationsForPaper(paper.id, user.id, user.role);
    const authorNames: Record<string, string> = {};
    for (const u of listAllUsers()) authorNames[u.id] = u.name;

    const exported = await buildExportPdf(pdfBytes, annotations, authorNames);
    const safeTitle = paper.title.replace(/[^a-zA-Z0-9_-]+/g, "_").slice(0, 60) || paper.id;
    return new NextResponse(Buffer.from(exported), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${safeTitle}-annotated.pdf"`,
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
