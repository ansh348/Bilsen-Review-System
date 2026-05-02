import { randomUUID } from "crypto";
import { readCollection, upsertCollection } from "@/lib/data-store";
import {
  AnnotationRecord,
  AnnotationVisibility,
  Role,
} from "@/lib/review-types";
import {
  CreateAnnotationInput,
  UpdateAnnotationInput,
} from "@/lib/validations/annotation";

function nowIso() {
  return new Date().toISOString();
}

function isVisibleTo(
  annotation: AnnotationRecord,
  viewerId: string,
  viewerRole: Role
): boolean {
  if (annotation.authorId === viewerId) return true;
  if (viewerRole === "COORDINATOR") return true;
  return annotation.visibility === "SHARED";
}

export function listAnnotationsForPaper(
  paperId: string,
  viewerId: string,
  viewerRole: Role,
  options?: { page?: number; kind?: AnnotationRecord["kind"]; authorId?: string }
): AnnotationRecord[] {
  const all = readCollection("annotations").filter((a) => a.paperId === paperId);
  return all.filter((a) => {
    if (!isVisibleTo(a, viewerId, viewerRole)) return false;
    if (options?.page !== undefined && a.pageNumber !== options.page) return false;
    if (options?.kind && a.kind !== options.kind) return false;
    if (options?.authorId && a.authorId !== options.authorId) return false;
    return true;
  });
}

export function getAnnotationById(id: string): AnnotationRecord | null {
  return (
    readCollection("annotations").find((a) => a.id === id) ?? null
  );
}

export function createAnnotation(
  paperId: string,
  authorId: string,
  input: CreateAnnotationInput
): AnnotationRecord {
  const timestamp = nowIso();
  const base = {
    id: randomUUID(),
    paperId,
    authorId,
    assignmentId: input.assignmentId ?? null,
    reviewId: null,
    kind: input.kind,
    pageNumber: input.pageNumber,
    visibility: "PRIVATE" as AnnotationVisibility,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  let record: AnnotationRecord;
  if (input.kind === "HIGHLIGHT") {
    record = { ...base, highlight: input.highlight };
  } else if (input.kind === "DOODLE") {
    record = { ...base, doodle: input.doodle };
  } else {
    record = {
      ...base,
      comment: {
        anchor: input.comment.anchor,
        text: input.comment.text,
        parentId: input.comment.parentId ?? null,
      },
    };
  }

  upsertCollection("annotations", (records) => [...records, record]);
  return record;
}

export function updateAnnotation(
  id: string,
  viewerId: string,
  viewerRole: Role,
  input: UpdateAnnotationInput
): AnnotationRecord {
  const existing = getAnnotationById(id);
  if (!existing) {
    throw new Error("Annotation not found");
  }
  if (existing.authorId !== viewerId && viewerRole !== "COORDINATOR") {
    throw new Error("You cannot edit this annotation");
  }

  let next: AnnotationRecord = { ...existing, updatedAt: nowIso() };
  if (input.comment && existing.comment) {
    next = { ...next, comment: { ...existing.comment, text: input.comment.text } };
  }
  if (input.highlight && existing.highlight) {
    next = {
      ...next,
      highlight: { ...existing.highlight, color: input.highlight.color },
    };
  }

  upsertCollection("annotations", (records) =>
    records.map((r) => (r.id === id ? next : r))
  );
  return next;
}

export function deleteAnnotation(
  id: string,
  viewerId: string,
  viewerRole: Role
): void {
  const existing = getAnnotationById(id);
  if (!existing) {
    throw new Error("Annotation not found");
  }
  if (existing.authorId !== viewerId && viewerRole !== "COORDINATOR") {
    throw new Error("You cannot delete this annotation");
  }
  upsertCollection("annotations", (records) =>
    records.filter((r) => r.id !== id)
  );
}

export function promoteReviewerAnnotationsToShared(
  assignmentId: string,
  reviewId: string
): number {
  let count = 0;
  upsertCollection("annotations", (records) =>
    records.map((r) => {
      if (r.assignmentId === assignmentId && r.visibility === "PRIVATE") {
        count += 1;
        return {
          ...r,
          visibility: "SHARED" as AnnotationVisibility,
          reviewId,
          updatedAt: nowIso(),
        };
      }
      return r;
    })
  );
  return count;
}
