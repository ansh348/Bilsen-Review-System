"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Document } from "react-pdf";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AnnotationRecord,
  AnnotationStroke,
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

  const handlePinOpenChange = (id: string | null) => setOpenPinId(id);

  const pageRefs = useRef<Map<number, HTMLDivElement | null>>(new Map());
  const isCoordinator = currentUserRole === "COORDINATOR";

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

  const handleCreateHighlight: React.ComponentProps<
    typeof PdfPage
  >["onCreateHighlight"] = async (pageNumber, payload) => {
    const created = await postAnnotation({
      kind: "HIGHLIGHT",
      pageNumber,
      highlight: payload,
    });
    if (created) setAnnotations((prev) => [...prev, created]);
  };

  const handleCreateDoodle: React.ComponentProps<
    typeof PdfPage
  >["onCreateDoodle"] = async (pageNumber, stroke: AnnotationStroke) => {
    const created = await postAnnotation({
      kind: "DOODLE",
      pageNumber,
      doodle: { strokes: [stroke] },
    });
    if (created) setAnnotations((prev) => [...prev, created]);
  };

  const handleCreateComment: React.ComponentProps<
    typeof PdfPage
  >["onCreateComment"] = async (pageNumber, anchor) => {
    const created = await postAnnotation({
      kind: "COMMENT",
      pageNumber,
      comment: { anchor, text: "New comment" },
    });
    if (created) {
      setAnnotations((prev) => [...prev, created]);
      setOpenPinId(created.id);
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

  const handleDeleteAnnotation = async (id: string) => {
    const ok = await deleteAnnotationApi(id);
    if (ok) {
      setAnnotations((prev) => prev.filter((a) => a.id !== id));
      if (openPinId === id) setOpenPinId(null);
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
      <div className="flex items-center justify-between border-b border-border px-4 py-2">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/papers/${paperId}`}>
              <ArrowLeft className="h-4 w-4" /> Back
            </Link>
          </Button>
          <h1 className="truncate text-sm font-semibold">{paperTitle}</h1>
        </div>
        {error && (
          <p className="text-xs text-destructive" role="alert">
            {error}
          </p>
        )}
      </div>

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
      />

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-auto bg-muted/20 p-4">
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
                onDeleteAnnotation={handleDeleteAnnotation}
                onSelectAnnotation={(id) => {
                  const found = annotations.find((a) => a.id === id);
                  if (found) scrollToAnnotation(found);
                }}
              />
            ))}
          </Document>
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
