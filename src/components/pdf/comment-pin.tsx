"use client";

import { useEffect, useRef, useState } from "react";
import { MessageCircle, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { AnnotationRecord } from "@/lib/review-types";
import { Tool } from "@/components/pdf/utils";

interface CommentPinProps {
  annotation: AnnotationRecord;
  authorName: string;
  canEdit: boolean;
  canDelete: boolean;
  tool: Tool;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdateText: (id: string, text: string) => Promise<void> | void;
  onDelete: (id: string) => Promise<void> | void;
}

export function CommentPin({
  annotation,
  authorName,
  canEdit,
  canDelete,
  tool,
  open,
  onOpenChange,
  onUpdateText,
  onDelete,
}: CommentPinProps) {
  const comment = annotation.comment;
  const [text, setText] = useState(comment?.text ?? "");
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pinClickable = tool === "cursor" || tool === "comment";

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        onOpenChange(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open, onOpenChange]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  if (!comment) return null;

  function handleTextChange(value: string) {
    setText(value);
    if (!canEdit) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onUpdateText(annotation.id, value);
    }, 500);
  }

  return (
    <div
      ref={containerRef}
      className="absolute"
      style={{
        left: `${comment.anchor.x * 100}%`,
        top: `${comment.anchor.y * 100}%`,
        zIndex: 5,
        transform: "translate(-50%, -50%)",
        pointerEvents: pinClickable || open ? "auto" : "none",
      }}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onOpenChange(!open);
        }}
        aria-label="Open comment"
        disabled={!pinClickable}
        className="flex h-7 w-7 items-center justify-center rounded-full border border-amber-700 bg-amber-300 text-amber-900 shadow hover:bg-amber-200 disabled:opacity-70"
        style={{
          pointerEvents: pinClickable ? "auto" : "none",
          cursor: pinClickable ? "pointer" : "default",
        }}
      >
        <MessageCircle className="h-4 w-4" />
      </button>

      {open && (
        <div
          className="absolute left-8 top-0 z-10 w-64 rounded-md border border-border bg-background p-3 shadow-lg"
          style={{ pointerEvents: "auto" }}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <p className="mb-1 text-xs font-medium text-muted-foreground">
            {authorName}
            {annotation.visibility === "PRIVATE" && (
              <span className="ml-1 rounded bg-muted px-1 text-[10px] uppercase">
                draft
              </span>
            )}
          </p>
          {canEdit ? (
            <Textarea
              value={text}
              onChange={(e) => handleTextChange(e.target.value)}
              rows={3}
              className="text-sm"
              placeholder="Type a comment…"
              autoFocus
            />
          ) : (
            <p className="whitespace-pre-wrap text-sm">{text}</p>
          )}
          {canDelete && (
            <div className="mt-2 flex justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onDelete(annotation.id)}
              >
                <Trash2 className="h-3 w-3" /> Delete
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
