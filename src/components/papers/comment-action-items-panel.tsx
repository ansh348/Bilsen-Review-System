"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CommentActionItemRecord } from "@/lib/review-types";
import { severityMeta } from "@/components/pdf/utils";

interface CommentActionItemsPanelProps {
  paperId: string;
  initialItems: CommentActionItemRecord[];
  hasComments: boolean;
}

export function CommentActionItemsPanel({
  paperId,
  initialItems,
  hasComments,
}: CommentActionItemsPanelProps) {
  const router = useRouter();
  const [items, setItems] = useState<CommentActionItemRecord[]>(initialItems);
  const [isExtracting, setIsExtracting] = useState(false);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const completedCount = items.filter((i) => i.completed).length;

  async function runExtract() {
    if (!hasComments) return;
    if (
      items.length > 0 &&
      completedCount > 0 &&
      !window.confirm(
        `Re-running will replace your current list, including ${completedCount} ticked item${
          completedCount === 1 ? "" : "s"
        }. Continue?`
      )
    ) {
      return;
    }
    setError(null);
    setIsExtracting(true);
    try {
      const response = await fetch(
        `/api/papers/${paperId}/comment-action-items`,
        { method: "POST" }
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(payload.error ?? "Failed to extract action items");
        return;
      }
      setItems(payload.items ?? []);
      router.refresh();
    } catch {
      setError("Failed to extract action items");
    } finally {
      setIsExtracting(false);
    }
  }

  async function toggleItem(item: CommentActionItemRecord) {
    const nextCompleted = !item.completed;
    setError(null);
    setItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, completed: nextCompleted } : i))
    );
    setPendingIds((prev) => new Set(prev).add(item.id));
    try {
      const response = await fetch(
        `/api/papers/${paperId}/comment-action-items/${item.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ completed: nextCompleted }),
        }
      );
      if (!response.ok) {
        setItems((prev) =>
          prev.map((i) =>
            i.id === item.id ? { ...i, completed: item.completed } : i
          )
        );
        const payload = await response.json().catch(() => ({}));
        setError(payload.error ?? "Failed to update item");
      } else {
        const payload = await response.json().catch(() => ({}));
        if (payload.item) {
          setItems((prev) =>
            prev.map((i) => (i.id === item.id ? payload.item : i))
          );
        }
      }
    } catch {
      setItems((prev) =>
        prev.map((i) =>
          i.id === item.id ? { ...i, completed: item.completed } : i
        )
      );
      setError("Failed to update item");
    } finally {
      setPendingIds((prev) => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm text-muted-foreground">
            {items.length === 0
              ? "Distill the reviewer comments into a checklist of revision tasks."
              : `${completedCount} of ${items.length} done`}
          </p>
        </div>
        {hasComments && (
          <Button
            type="button"
            variant={items.length === 0 ? "default" : "outline"}
            size="sm"
            onClick={runExtract}
            disabled={isExtracting}
          >
            <Sparkles className="h-3.5 w-3.5" />
            {isExtracting
              ? "Extracting..."
              : items.length === 0
                ? "Extract from comments"
                : "Re-extract"}
          </Button>
        )}
      </div>

      {!hasComments && (
        <p className="text-sm text-muted-foreground">
          Reviewers haven&apos;t left any comments yet — extraction will be
          available once they do.
        </p>
      )}

      {hasComments && items.length === 0 && !isExtracting && (
        <p className="text-sm text-muted-foreground">
          No action items yet. Click <strong>Extract from comments</strong> to
          generate a tickable list with AI.
        </p>
      )}

      {items.length > 0 && (
        <ul className="space-y-2">
          {items.map((item) => {
            const meta = severityMeta(item.severity ?? undefined);
            const pending = pendingIds.has(item.id);
            return (
              <li
                key={item.id}
                className={`flex items-start gap-3 rounded-md border border-border bg-background p-3 ${
                  item.completed ? "opacity-60" : ""
                }`}
              >
                <input
                  type="checkbox"
                  checked={item.completed}
                  disabled={pending}
                  onChange={() => toggleItem(item)}
                  className="mt-1 h-4 w-4 cursor-pointer accent-foreground"
                  aria-label={
                    item.completed ? "Mark as not done" : "Mark as done"
                  }
                />
                <div className="min-w-0 flex-1 space-y-1">
                  <p
                    className={`text-sm ${
                      item.completed ? "line-through" : ""
                    }`}
                  >
                    {item.text}
                  </p>
                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                    {item.severity && (
                      <span
                        className={`rounded-full border px-1.5 py-0.5 font-semibold uppercase ${meta.pillClass}`}
                      >
                        {meta.label}
                      </span>
                    )}
                    {item.sourcePages.length > 0 && (
                      <Link
                        href={`/papers/${paperId}/view`}
                        className="underline-offset-2 hover:underline"
                      >
                        Page{item.sourcePages.length === 1 ? " " : "s "}
                        {item.sourcePages.join(", ")}
                      </Link>
                    )}
                    <span>
                      from {item.sourceCommentIds.length} comment
                      {item.sourceCommentIds.length === 1 ? "" : "s"}
                    </span>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
