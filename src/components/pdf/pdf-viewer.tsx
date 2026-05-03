"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Document } from "react-pdf";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AnnotationRecord,
  AnnotationStroke,
  CommentSeverity,
  Role,
} from "@/lib/review-types";
import {
  HIGHLIGHT_COLORS,
  DOODLE_COLORS,
  Tool,
} from "@/components/pdf/utils";
import { PdfToolbar } from "@/components/pdf/pdf-toolbar";
import { PdfPage } from "@/components/pdf/pdf-page";
import { AnnotationsSidebar } from "@/components/pdf/annotations-sidebar";
import { useSetTopbarLeft } from "@/components/dashboard/topbar-slot-context";

import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

interface PdfViewerProps {
  paperId: string;
  paperTitle: string;
  pdfUrl: string;
  currentUserId: string;
  currentUserRole: Role;
  authorNames: Record<string, string>;
  initialAnnotations: AnnotationRecord[];
  assignmentId: string | null;
}

const BASE_PAGE_WIDTH = 800;
const DOODLE_SIZE = 0.005;

type CreateBody = {
  kind: AnnotationRecord["kind"];
  pageNumber: number;
  highlight?: AnnotationRecord["highlight"];
  doodle?: AnnotationRecord["doodle"];
  comment?: AnnotationRecord["comment"];
};

type HistoryOp =
  | { type: "create"; record: AnnotationRecord; body: CreateBody }
  | { type: "delete"; record: AnnotationRecord; body: CreateBody };

function recordToBody(r: AnnotationRecord): CreateBody {
  switch (r.kind) {
    case "HIGHLIGHT":
      return { kind: "HIGHLIGHT", pageNumber: r.pageNumber, highlight: r.highlight };
    case "DOODLE":
      return { kind: "DOODLE", pageNumber: r.pageNumber, doodle: r.doodle };
    case "COMMENT":
      return { kind: "COMMENT", pageNumber: r.pageNumber, comment: r.comment };
  }
}

export function PdfViewer({
  paperId,
  paperTitle,
  pdfUrl,
  currentUserId,
  currentUserRole,
  authorNames,
  initialAnnotations,
  assignmentId,
}: PdfViewerProps) {
  const [annotations, setAnnotations] =
    useState<AnnotationRecord[]>(initialAnnotations);
  const [tool, setTool] = useState<Tool>("cursor");
  const [highlightColor, setHighlightColor] = useState<string>(
    HIGHLIGHT_COLORS[0]
  );
  const [doodleColor, setDoodleColor] = useState<string>(DOODLE_COLORS[0]);
  const [zoom, setZoom] = useState<number>(1);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [openPinId, setOpenPinId] = useState<string | null>(null);
  const [undoStack, setUndoStack] = useState<HistoryOp[]>([]);
  const [redoStack, setRedoStack] = useState<HistoryOp[]>([]);

  const handlePinOpenChange = (id: string | null) => setOpenPinId(id);

  const pageRefs = useRef<Map<number, HTMLDivElement | null>>(new Map());
  const isCoordinator = currentUserRole === "COORDINATOR";

  const topbarLeft = useMemo(
    () => (
      <div className="flex min-w-0 items-center gap-2">
        <Button variant="outline" size="sm" asChild>
          <Link href={`/papers/${paperId}`}>
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
        </Button>
        <span className="hidden h-5 w-px bg-border sm:block" />
        <h1 className="truncate text-sm font-semibold">{paperTitle}</h1>
      </div>
    ),
    [paperId, paperTitle]
  );
  useSetTopbarLeft(topbarLeft);

  const activeColor = tool === "doodle" ? doodleColor : highlightColor;

  const onColorChange = (c: string) => {
    if (tool === "doodle") setDoodleColor(c);
    else setHighlightColor(c);
  };

  const registerPageRef = useCallback(
    (page: number, ref: HTMLDivElement | null) => {
      pageRefs.current.set(page, ref);
    },
    []
  );

  const annotationsByPage = useMemo(() => {
    const m = new Map<number, AnnotationRecord[]>();
    for (const a of annotations) {
      const list = m.get(a.pageNumber) ?? [];
      list.push(a);
      m.set(a.pageNumber, list);
    }
    return m;
  }, [annotations]);

  async function postAnnotation(body: object): Promise<AnnotationRecord | null> {
    try {
      const res = await fetch(`/api/papers/${paperId}/annotations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...body,
          assignmentId: assignmentId ?? undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }
      const data = await res.json();
      return data.annotation as AnnotationRecord;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
      return null;
    }
  }

  async function patchAnnotation(
    id: string,
    body: object
  ): Promise<AnnotationRecord | null> {
    try {
      const res = await fetch(`/api/annotations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }
      const data = await res.json();
      return data.annotation as AnnotationRecord;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update");
      return null;
    }
  }

  async function deleteAnnotationApi(id: string): Promise<boolean> {
    try {
      const res = await fetch(`/api/annotations/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete");
      return false;
    }
  }

  const pushUndo = (op: HistoryOp) => {
    setUndoStack((prev) => [...prev, op]);
    setRedoStack([]);
  };

  const handleCreateHighlight: React.ComponentProps<
    typeof PdfPage
  >["onCreateHighlight"] = async (pageNumber, payload) => {
    const body: CreateBody = {
      kind: "HIGHLIGHT",
      pageNumber,
      highlight: payload,
    };
    const created = await postAnnotation(body);
    if (created) {
      setAnnotations((prev) => [...prev, created]);
      pushUndo({ type: "create", record: created, body });
    }
  };

  const handleCreateDoodle: React.ComponentProps<
    typeof PdfPage
  >["onCreateDoodle"] = async (pageNumber, stroke: AnnotationStroke) => {
    const body: CreateBody = {
      kind: "DOODLE",
      pageNumber,
      doodle: { strokes: [stroke] },
    };
    const created = await postAnnotation(body);
    if (created) {
      setAnnotations((prev) => [...prev, created]);
      pushUndo({ type: "create", record: created, body });
    }
  };

  const handleCreateComment: React.ComponentProps<
    typeof PdfPage
  >["onCreateComment"] = async (pageNumber, anchor) => {
    const body: CreateBody = {
      kind: "COMMENT",
      pageNumber,
      comment: { anchor, text: "" },
    };
    const created = await postAnnotation(body);
    if (created) {
      setAnnotations((prev) => [...prev, created]);
      setOpenPinId(created.id);
      pushUndo({ type: "create", record: created, body });
    }
  };

  const handleUpdateComment = async (id: string, text: string) => {
    const updated = await patchAnnotation(id, { comment: { text } });
    if (updated) {
      setAnnotations((prev) =>
        prev.map((a) => (a.id === id ? updated : a))
      );
    }
  };

  const handleUpdateCommentSeverity = async (
    id: string,
    severity: CommentSeverity
  ) => {
    const updated = await patchAnnotation(id, { comment: { severity } });
    if (updated) {
      setAnnotations((prev) =>
        prev.map((a) => (a.id === id ? updated : a))
      );
    }
  };

  const handleDeleteAnnotation = async (id: string) => {
    const target = annotations.find((a) => a.id === id);
    const ok = await deleteAnnotationApi(id);
    if (ok) {
      setAnnotations((prev) => prev.filter((a) => a.id !== id));
      if (openPinId === id) setOpenPinId(null);
      if (target) {
        pushUndo({ type: "delete", record: target, body: recordToBody(target) });
      }
    }
  };

  const handleUndo = async () => {
    if (undoStack.length === 0) return;
    const op = undoStack[undoStack.length - 1];
    if (op.type === "create") {
      const ok = await deleteAnnotationApi(op.record.id);
      if (!ok) return;
      setAnnotations((prev) => prev.filter((a) => a.id !== op.record.id));
      if (openPinId === op.record.id) setOpenPinId(null);
      setUndoStack((prev) => prev.slice(0, -1));
      setRedoStack((prev) => [...prev, op]);
    } else {
      const recreated = await postAnnotation(op.body);
      if (!recreated) return;
      setAnnotations((prev) => [...prev, recreated]);
      setUndoStack((prev) => prev.slice(0, -1));
      setRedoStack((prev) => [
        ...prev,
        { type: "delete", record: recreated, body: op.body },
      ]);
    }
  };

  const handleRedo = async () => {
    if (redoStack.length === 0) return;
    const op = redoStack[redoStack.length - 1];
    if (op.type === "create") {
      const recreated = await postAnnotation(op.body);
      if (!recreated) return;
      setAnnotations((prev) => [...prev, recreated]);
      setRedoStack((prev) => prev.slice(0, -1));
      setUndoStack((prev) => [
        ...prev,
        { type: "create", record: recreated, body: op.body },
      ]);
    } else {
      const ok = await deleteAnnotationApi(op.record.id);
      if (!ok) return;
      setAnnotations((prev) => prev.filter((a) => a.id !== op.record.id));
      if (openPinId === op.record.id) setOpenPinId(null);
      setRedoStack((prev) => prev.slice(0, -1));
      setUndoStack((prev) => [...prev, op]);
    }
  };

  const scrollToAnnotation = (a: AnnotationRecord) => {
    const node = pageRefs.current.get(a.pageNumber);
    if (node) {
      node.scrollIntoView({ behavior: "smooth", block: "center" });
      setCurrentPage(a.pageNumber);
    }
    if (a.kind === "COMMENT") setOpenPinId(a.id);
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      {error && (
        <p
          role="alert"
          className="border-b border-destructive/40 bg-destructive/10 px-4 py-1 text-xs text-destructive"
        >
          {error}
        </p>
      )}

      <div className="flex flex-1 overflow-hidden">
        <div className="relative flex-1 overflow-hidden">
          <div className="pointer-events-none absolute inset-x-0 top-3 z-10 flex justify-center px-4">
            <div className="pointer-events-auto">
              <PdfToolbar
                tool={tool}
                onToolChange={setTool}
                color={activeColor}
                onColorChange={onColorChange}
                zoom={zoom}
                onZoomChange={setZoom}
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={(p) => {
                  setCurrentPage(p);
                  const node = pageRefs.current.get(p);
                  if (node) node.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
                canUndo={undoStack.length > 0}
                canRedo={redoStack.length > 0}
                onUndo={handleUndo}
                onRedo={handleRedo}
              />
            </div>
          </div>
          <div className="h-full overflow-auto bg-muted/20 px-4 pb-4 pt-16">
            <Document
              file={pdfUrl}
              onLoadSuccess={(info) => setTotalPages(info.numPages)}
              onLoadError={(e) =>
                setError(`Failed to load PDF: ${e.message}`)
              }
              loading={<p className="text-sm text-muted-foreground">Loading PDF…</p>}
              error={
                <p className="text-sm text-destructive">
                  Failed to load PDF. Try downloading it instead.
                </p>
              }
            >
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                <PdfPage
                  key={n}
                  pageNumber={n}
                  scale={zoom}
                  baseWidth={BASE_PAGE_WIDTH}
                  tool={tool}
                  color={activeColor}
                  doodleSize={DOODLE_SIZE}
                  annotations={annotationsByPage.get(n) ?? []}
                  authorNames={authorNames}
                  currentUserId={currentUserId}
                  isCoordinator={isCoordinator}
                  openPinId={openPinId}
                  onPinOpenChange={handlePinOpenChange}
                  registerPageRef={registerPageRef}
                  onCreateHighlight={handleCreateHighlight}
                  onCreateDoodle={handleCreateDoodle}
                  onCreateComment={handleCreateComment}
                  onUpdateComment={handleUpdateComment}
                  onUpdateCommentSeverity={handleUpdateCommentSeverity}
                  onDeleteAnnotation={handleDeleteAnnotation}
                  onSelectAnnotation={(id) => {
                    const found = annotations.find((a) => a.id === id);
                    if (found) scrollToAnnotation(found);
                  }}
                />
              ))}
            </Document>
          </div>
        </div>

        <AnnotationsSidebar
          annotations={annotations}
          authorNames={authorNames}
          currentUserId={currentUserId}
          isCoordinator={isCoordinator}
          onSelect={scrollToAnnotation}
          onDelete={handleDeleteAnnotation}
        />
      </div>
    </div>
  );
}
