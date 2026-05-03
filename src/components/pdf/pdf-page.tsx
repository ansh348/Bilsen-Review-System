"use client";

import { useRef } from "react";
import { Page } from "react-pdf";
import { AnnotationRecord, AnnotationStroke } from "@/lib/review-types";
import { Tool } from "@/components/pdf/utils";
import { HighlightLayer } from "@/components/pdf/highlight-layer";
import { DoodleLayer } from "@/components/pdf/doodle-layer";
import { CommentPin } from "@/components/pdf/comment-pin";

interface PdfPageProps {
  pageNumber: number;
  scale: number;
  baseWidth: number;
  tool: Tool;
  color: string;
  doodleSize: number;
  annotations: AnnotationRecord[];
  authorNames: Record<string, string>;
  currentUserId: string;
  isCoordinator: boolean;
  openPinId: string | null;
  onPinOpenChange: (id: string | null) => void;
  registerPageRef: (page: number, ref: HTMLDivElement | null) => void;
  onCreateHighlight: (
    pageNumber: number,
    payload: {
      rects: { x: number; y: number; width: number; height: number }[];
      text: string;
      color: string;
    }
  ) => void;
  onCreateDoodle: (pageNumber: number, stroke: AnnotationStroke) => void;
  onCreateComment: (
    pageNumber: number,
    anchor: { x: number; y: number }
  ) => void;
  onUpdateComment: (id: string, text: string) => Promise<void> | void;
  onUpdateCommentSeverity: (
    id: string,
    severity: import("@/lib/review-types").CommentSeverity
  ) => Promise<void> | void;
  onDeleteAnnotation: (id: string) => Promise<void> | void;
  onSelectAnnotation: (id: string) => void;
}

export function PdfPage({
  pageNumber,
  scale,
  baseWidth,
  tool,
  color,
  doodleSize,
  annotations,
  authorNames,
  currentUserId,
  isCoordinator,
  openPinId,
  onPinOpenChange,
  registerPageRef,
  onCreateHighlight,
  onCreateDoodle,
  onCreateComment,
  onUpdateComment,
  onUpdateCommentSeverity,
  onDeleteAnnotation,
  onSelectAnnotation,
}: PdfPageProps) {
  const pageRef = useRef<HTMLDivElement | null>(null);

  const highlights = annotations.filter((a) => a.kind === "HIGHLIGHT");
  const doodles = annotations.filter((a) => a.kind === "DOODLE");
  const comments = annotations.filter((a) => a.kind === "COMMENT");

  const handleCommentPlace = (e: React.MouseEvent<HTMLDivElement>) => {
    if (tool !== "comment") return;
    const target = e.target as HTMLElement;
    if (target.closest("[data-pin]")) return;
    const node = pageRef.current;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    const anchor = {
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
    };
    onCreateComment(pageNumber, anchor);
  };

  const renderedWidth = baseWidth * scale;
  const interactionsDisabledOnText =
    tool === "doodle" || tool === "comment" ? "none" : "auto";

  return (
    <div className="mb-6 flex flex-col items-center">
      <p className="mb-1 text-xs text-muted-foreground">Page {pageNumber}</p>
      <div
        ref={(el) => {
          pageRef.current = el;
          registerPageRef(pageNumber, el);
        }}
        className="relative shadow"
        data-page-number={pageNumber}
        onDoubleClick={handleCommentPlace}
        style={
          {
            width: renderedWidth,
            cursor: tool === "comment" ? "crosshair" : undefined,
            ["--text-pe" as string]: interactionsDisabledOnText,
          } as React.CSSProperties
        }
      >
        <style>{`
          [data-page-number="${pageNumber}"] .react-pdf__Page__textContent {
            pointer-events: var(--text-pe);
          }
          [data-page-number="${pageNumber}"] .react-pdf__Page__annotations {
            pointer-events: none;
          }
        `}</style>
        <Page
          pageNumber={pageNumber}
          width={renderedWidth}
          renderAnnotationLayer={false}
          renderTextLayer={true}
        />

        <DoodleLayer
          pageRef={pageRef}
          tool={tool}
          color={color}
          size={doodleSize}
          doodles={doodles}
          onCreate={(stroke) => onCreateDoodle(pageNumber, stroke)}
          onClickAnnotation={onSelectAnnotation}
        />

        <HighlightLayer
          pageRef={pageRef}
          tool={tool}
          color={color}
          highlights={highlights}
          onCreate={(payload) => onCreateHighlight(pageNumber, payload)}
          onClickAnnotation={onSelectAnnotation}
        />

        {comments.map((c) => (
          <div key={c.id} data-pin>
            <CommentPin
              annotation={c}
              authorName={authorNames[c.authorId] ?? "Unknown"}
              canEdit={c.authorId === currentUserId || isCoordinator}
              canDelete={c.authorId === currentUserId || isCoordinator}
              tool={tool}
              open={c.id === openPinId}
              onOpenChange={(o) => onPinOpenChange(o ? c.id : null)}
              onUpdateText={onUpdateComment}
              onUpdateSeverity={onUpdateCommentSeverity}
              onDelete={onDeleteAnnotation}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
