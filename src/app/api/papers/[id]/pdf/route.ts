import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { getAuthenticatedUser } from "@/lib/auth-helpers";
import { handleRouteError, jsonError } from "@/lib/api-route";
import { canUserAccessPaper, getPaperById } from "@/lib/review-service";

interface Params {
  params: Promise<{ id: string }>;
}

const UPLOADS_DIR = path.resolve(process.cwd(), "data", "uploads");

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

    if (paper.pdfPath) {
      const resolved = path.resolve(process.cwd(), paper.pdfPath);
      if (!resolved.startsWith(UPLOADS_DIR + path.sep)) {
        return jsonError("Invalid PDF path", 400);
      }
      try {
        const buf = await fs.readFile(resolved);
        return new NextResponse(buf, {
          status: 200,
          headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition": `inline; filename="${paper.id}.pdf"`,
          },
        });
      } catch {
        return jsonError("PDF file not found on disk", 404);
      }
    }

    if (paper.pdfUrl) {
      return NextResponse.redirect(paper.pdfUrl);
    }

    return jsonError("No PDF available for this paper", 404);
  } catch (error) {
    return handleRouteError(error);
  }
}
