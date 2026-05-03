import { randomUUID } from "crypto";
import { readCollection, upsertCollection } from "@/lib/data-store";
import {
  CommentActionItemRecord,
  CommentSeverity,
} from "@/lib/review-types";

function nowIso() {
  return new Date().toISOString();
}

export function listCommentActionItemsForPaper(
  paperId: string
): CommentActionItemRecord[] {
  return readCollection("commentActionItems")
    .filter((item) => item.paperId === paperId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export function getCommentActionItemById(
  id: string
): CommentActionItemRecord | null {
  return (
    readCollection("commentActionItems").find((item) => item.id === id) ?? null
  );
}

export interface CommentActionItemDraft {
  text: string;
  severity: CommentSeverity | null;
  sourceCommentIds: string[];
  sourcePages: number[];
}

export function replaceCommentActionItemsForPaper(
  paperId: string,
  drafts: CommentActionItemDraft[]
): CommentActionItemRecord[] {
  const runId = randomUUID();
  const timestamp = nowIso();
  const fresh: CommentActionItemRecord[] = drafts.map((draft) => ({
    id: randomUUID(),
    paperId,
    runId,
    text: draft.text,
    severity: draft.severity,
    sourceCommentIds: draft.sourceCommentIds,
    sourcePages: draft.sourcePages,
    completed: false,
    completedBy: null,
    completedAt: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  }));

  upsertCollection("commentActionItems", (records) => [
    ...records.filter((r) => r.paperId !== paperId),
    ...fresh,
  ]);
  return fresh;
}

export function setCommentActionItemCompleted(
  itemId: string,
  viewerId: string,
  completed: boolean
): CommentActionItemRecord {
  const existing = getCommentActionItemById(itemId);
  if (!existing) {
    throw new Error("Action item not found");
  }
  const next: CommentActionItemRecord = {
    ...existing,
    completed,
    completedBy: completed ? viewerId : null,
    completedAt: completed ? nowIso() : null,
    updatedAt: nowIso(),
  };
  upsertCollection("commentActionItems", (records) =>
    records.map((r) => (r.id === itemId ? next : r))
  );
  return next;
}
