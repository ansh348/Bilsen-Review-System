import { NextResponse } from "next/server";
import { getAuthenticatedUser, requireCoordinatorUser } from "@/lib/auth-helpers";
import {
  canUserAccessPaper,
  canUserManagePaper,
  createNotification,
  deletePaper,
  getPaperDetails,
  snapshotPaperVersion,
  updatePaper,
} from "@/lib/review-service";
import { handleRouteError, jsonError } from "@/lib/api-route";
import { updatePaperSchema } from "@/lib/validations/review";
import { resolveUploadPdfPath } from "@/lib/uploads";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_: Request, { params }: RouteParams) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return jsonError("Unauthorized", 401);
    }

    const { id } = await params;
    const details = getPaperDetails(id);
    if (!details) {
      return jsonError("Paper not found", 404);
    }

    if (!canUserAccessPaper(id, user.id, user.role)) {
      return jsonError("Forbidden", 403);
    }

    return NextResponse.json(details);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return jsonError("Unauthorized", 401);
    }

    const { id } = await params;
    const details = getPaperDetails(id);
    if (!details) {
      return jsonError("Paper not found", 404);
    }

    const isCoordinator = user.role === "COORDINATOR";
    if (!canUserManagePaper(id, user.id, user.role)) {
      return jsonError("Forbidden", 403);
    }

    const body = await request.json();
    const parsed = updatePaperSchema.parse(body);
    if (parsed.status && !isCoordinator) {
      return jsonError("Only coordinators can update paper status", 403);
    }

    const { uploadId, ...rest } = parsed;
    const updateInput: typeof rest & { pdfPath?: string | null } = { ...rest };
    if (uploadId) {
      const pdfPath = await resolveUploadPdfPath(uploadId);
      if (!pdfPath) {
        return jsonError("Uploaded file not found — please re-upload", 400);
      }
      const previous = details.paper;
      const isReplacingExisting = Boolean(
        (previous.pdfPath || previous.pdfUrl) && pdfPath !== previous.pdfPath
      );
      if (isReplacingExisting) {
        snapshotPaperVersion(
          id,
          previous.status === "REVISION_REQUESTED" ? "REVISION" : "MANUAL_REUPLOAD"
        );
      }
      updateInput.pdfPath = pdfPath;
      updateInput.pdfUrl = null;
    }

    const previousStatus = details.paper.status;
    const paper = updatePaper(id, updateInput);

    if (
      paper.status !== previousStatus &&
      (paper.status === "ACCEPTED" || paper.status === "REJECTED")
    ) {
      const accepted = paper.status === "ACCEPTED";
      for (const authorId of paper.authorIds) {
        createNotification({
          userId: authorId,
          type: accepted ? "PAPER_ACCEPTED" : "PAPER_REJECTED",
          title: accepted ? "Paper accepted" : "Paper rejected",
          message: accepted
            ? `Your paper "${paper.title}" has been accepted.`
            : `Your paper "${paper.title}" was not accepted. See the paper page for reviewer feedback.`,
          link: `/papers/${paper.id}`,
          sentViaEmail: true,
          sentViaSlack: false,
        });
      }
    }

    return NextResponse.json({ paper });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(_: Request, { params }: RouteParams) {
  try {
    const authz = await requireCoordinatorUser();
    if (!authz.allowed) {
      return jsonError(
        authz.reason === "UNAUTHENTICATED" ? "Unauthorized" : "Forbidden",
        authz.reason === "UNAUTHENTICATED" ? 401 : 403
      );
    }

    const { id } = await params;
    deletePaper(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
