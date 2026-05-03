"use client";

import {
  MousePointer2,
  Highlighter,
  Pencil,
  MessageSquare,
  ZoomIn,
  ZoomOut,
  ChevronLeft,
  ChevronRight,
  Undo2,
  Redo2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DOODLE_COLORS,
  HIGHLIGHT_COLORS,
  Tool,
} from "@/components/pdf/utils";

interface PdfToolbarProps {
  tool: Tool;
  onToolChange: (tool: Tool) => void;
  color: string;
  onColorChange: (color: string) => void;
  zoom: number;
  onZoomChange: (zoom: number) => void;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
}

export function PdfToolbar({
  tool,
  onToolChange,
  color,
  onColorChange,
  zoom,
  onZoomChange,
  currentPage,
  totalPages,
  onPageChange,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
}: PdfToolbarProps) {
  const palette = tool === "doodle" ? DOODLE_COLORS : HIGHLIGHT_COLORS;

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border/70 bg-card/85 px-2 py-1.5 shadow-lg backdrop-blur-md">
      <div className="flex items-center gap-1">
        <ToolButton
          active={tool === "cursor"}
          onClick={() => onToolChange("cursor")}
          label="Select"
        >
          <MousePointer2 className="h-4 w-4" />
        </ToolButton>
        <ToolButton
          active={tool === "highlight"}
          onClick={() => onToolChange("highlight")}
          label="Highlight"
        >
          <Highlighter className="h-4 w-4" />
        </ToolButton>
        <ToolButton
          active={tool === "doodle"}
          onClick={() => onToolChange("doodle")}
          label="Doodle"
        >
          <Pencil className="h-4 w-4" />
        </ToolButton>
        <ToolButton
          active={tool === "comment"}
          onClick={() => onToolChange("comment")}
          label="Comment"
        >
          <MessageSquare className="h-4 w-4" />
        </ToolButton>
      </div>

      <div className="mx-1 h-6 w-px bg-border" />
      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onUndo}
          disabled={!canUndo}
          title="Undo"
          aria-label="Undo"
        >
          <Undo2 className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onRedo}
          disabled={!canRedo}
          title="Redo"
          aria-label="Redo"
        >
          <Redo2 className="h-4 w-4" />
        </Button>
      </div>

      {(tool === "highlight" || tool === "doodle") && (
        <>
          <div className="mx-1 h-6 w-px bg-border" />
          <div className="flex items-center gap-1">
            {palette.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => onColorChange(c)}
                aria-label={`Color ${c}`}
                className={`h-6 w-6 rounded-full border-2 transition ${
                  color === c
                    ? "border-foreground"
                    : "border-transparent hover:border-muted-foreground"
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </>
      )}

      <div className="ml-auto flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage <= 1}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-xs text-muted-foreground">
          Page {currentPage} / {totalPages || "—"}
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            onPageChange(Math.min(totalPages || currentPage, currentPage + 1))
          }
          disabled={!totalPages || currentPage >= totalPages}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>

        <div className="mx-1 h-6 w-px bg-border" />

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onZoomChange(Math.max(0.5, zoom - 0.1))}
          disabled={zoom <= 0.5}
        >
          <ZoomOut className="h-4 w-4" />
        </Button>
        <span className="w-10 text-center text-xs text-muted-foreground">
          {Math.round(zoom * 100)}%
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onZoomChange(Math.min(2.5, zoom + 0.1))}
          disabled={zoom >= 2.5}
        >
          <ZoomIn className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function ToolButton({
  active,
  onClick,
  label,
  children,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-pressed={active}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-md border transition ${
        active
          ? "border-foreground bg-foreground text-background"
          : "border-border bg-background text-foreground hover:bg-muted"
      }`}
    >
      {children}
    </button>
  );
}
