"use client";

import { useMemo, useState } from "react";
import { Highlighter, Pencil, MessageSquare, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AnnotationKind, AnnotationRecord } from "@/lib/review-types";

interface AnnotationsSidebarProps {
  annotations: AnnotationRecord[];
  authorNames: Record<string, string>;
  currentUserId: string;
  isCoordinator: boolean;
  onSelect: (annotation: AnnotationRecord) => void;
  onDelete: (id: string) => void;
}

const KIND_FILTERS: Array<{ key: "ALL" | AnnotationKind; label: string }> = [
  { key: "ALL", label: "All" },
  { key: "HIGHLIGHT", label: "Highlights" },
  { key: "DOODLE", label: "Doodles" },
  { key: "COMMENT", label: "Comments" },
];

export function AnnotationsSidebar({
  annotations,
  authorNames,
  currentUserId,
  isCoordinator,
  onSelect,
  onDelete,
}: AnnotationsSidebarProps) {
  const [filter, setFilter] = useState<"ALL" | AnnotationKind>("ALL");

  const filtered = useMemo(() => {
    const list =
      filter === "ALL" ? annotations : annotations.filter((a) => a.kind === filter);
    return [...list].sort((a, b) => {
      if (a.pageNumber !== b.pageNumber) return a.pageNumber - b.pageNumber;
      return a.createdAt.localeCompare(b.createdAt);
    });
  }, [annotations, filter]);

  return (
    <aside className="flex h-full w-80 flex-col border-l border-border bg-background">
      <div className="border-b border-border p-3">
        <h2 className="text-sm font-semibold">Annotations</h2>
        <p className="text-xs text-muted-foreground">
          {annotations.length} total
        </p>
        <div className="mt-2 flex flex-wrap gap-1">
          {KIND_FILTERS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={`rounded-full border px-2 py-0.5 text-xs transition ${
                filter === key
                  ? "border-foreground bg-foreground text-background"
                  : "border-border bg-background text-foreground hover:bg-muted"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <p className="p-4 text-xs text-muted-foreground">
            No annotations yet. Pick a tool above and start marking up the page.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {filtered.map((a) => {
              const canDelete =
                a.authorId === currentUserId || isCoordinator;
              return (
                <li
                  key={a.id}
                  className="cursor-pointer p-3 hover:bg-muted/50"
                  onClick={() => onSelect(a)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <KindIcon kind={a.kind} />
                        <span className="text-xs font-medium">
                          Page {a.pageNumber}
                        </span>
                        {a.visibility === "PRIVATE" && (
                          <Badge variant="outline" className="text-[10px]">
                            draft
                          </Badge>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {authorNames[a.authorId] ?? "Unknown"}
                      </p>
                      <p className="mt-1 line-clamp-2 text-xs">
                        {summarize(a)}
                      </p>
                    </div>
                    {canDelete && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="shrink-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete(a.id);
                        }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </aside>
  );
}

function KindIcon({ kind }: { kind: AnnotationKind }) {
  if (kind === "HIGHLIGHT") return <Highlighter className="h-3 w-3" />;
  if (kind === "DOODLE") return <Pencil className="h-3 w-3" />;
  return <MessageSquare className="h-3 w-3" />;
}

function summarize(a: AnnotationRecord): string {
  if (a.kind === "HIGHLIGHT" && a.highlight) {
    return `"${a.highlight.text.slice(0, 120)}${
      a.highlight.text.length > 120 ? "…" : ""
    }"`;
  }
  if (a.kind === "COMMENT" && a.comment) {
    return a.comment.text.slice(0, 200);
  }
  if (a.kind === "DOODLE" && a.doodle) {
    return `${a.doodle.strokes.length} stroke${
      a.doodle.strokes.length === 1 ? "" : "s"
    }`;
  }
  return "";
}
