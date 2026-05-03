import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { getAuthenticatedUser } from "@/lib/auth-helpers";
import { handleRouteError, jsonError } from "@/lib/api-route";
import {
  canUserAccessPaper,
  getPaperById,
  getPaperVersionById,
} from "@/lib/review-service";

interface RouteParams {
  params: Promise<{ id: string; versionId: string }>;
}

const UPLOADS_DIR = path.resolve(process.cwd(), "data", "uploads");

export async function GET(_: Request, { params }: RouteParams) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return jsonError("Unauthorized", 401);

    const { id, versionId } = await params;
    const paper = getPaperById(id);
    if (!paper) return jsonError("Paper not found", 404);
    if (!canUserAccessPaper(paper.id, user.id, user.role)) {
      return jsonError("Forbidden", 403);
    }

    const version = getPaperVersionById(id, versionId);
    if (!version) return jsonError("Version not found", 404);

    if (version.pdfPath) {
      const resolved = path.resolve(process.cwd(), version.pdfPath);
      if (!resolved.startsWith(UPLOADS_DIR + path.sep)) {
        return jsonError("Invalid PDF path", 400);
      }
      try {
        const buf = await fs.readFile(resolved);
        return new NextResponse(buf, {
          status: 200,
          headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition": `inline; filename="${paper.id}-v${version.versionNumber}.pdf"`,
          },
        });
      } catch {
        return jsonError("PDF file not found on disk", 404);
      }
    }

    if (version.pdfUrl) {
      return NextResponse.redirect(version.pdfUrl);
    }

    return jsonError("No PDF available for this version", 404);
  } catch (error) {
    return handleRouteError(error);
  }
}
