"use client";

import { useEffect, useRef } from "react";
import { AnnotationRecord } from "@/lib/review-types";
import { Tool } from "@/components/pdf/utils";

interface HighlightLayerProps {
  pageRef: React.RefObject<HTMLDivElement | null>;
  tool: Tool;
  color: string;
  highlights: AnnotationRecord[];
  onCreate: (highlight: {
    rects: { x: number; y: number; width: number; height: number }[];
    text: string;
    color: string;
  }) => void;
  onClickAnnotation: (id: string) => void;
}

export function HighlightLayer({
  pageRef,
  tool,
  color,
  highlights,
  onCreate,
  onClickAnnotation,
}: HighlightLayerProps) {
  const active = tool === "highlight";
  const rectsClickable = tool === "cursor";
  const colorRef = useRef(color);
  const activeRef = useRef(active);

  useEffect(() => {
    colorRef.current = color;
  }, [color]);
  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  useEffect(() => {
    const node = pageRef.current;
    if (!node) return;

    function handleMouseUp() {
      if (!activeRef.current) return;
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed) return;
      const range = selection.getRangeAt(0);
      const text = selection.toString().trim();
      if (!text) return;

      const pageNode = pageRef.current;
      if (!pageNode) return;
      if (!pageNode.contains(range.commonAncestorContainer)) return;

      const pageRect = pageNode.getBoundingClientRect();
      const clientRects = Array.from(range.getClientRects()).filter(
        (r) => r.width > 0 && r.height > 0
      );
      if (clientRects.length === 0) return;

      const rects = clientRects.map((r) => ({
        x: (r.left - pageRect.left) / pageRect.width,
        y: (r.top - pageRect.top) / pageRect.height,
        width: r.width / pageRect.width,
        height: r.height / pageRect.height,
      }));

      onCreate({ rects, text, color: colorRef.current });
      selection.removeAllRanges();
    }

    node.addEventListener("mouseup", handleMouseUp);
    return () => node.removeEventListener("mouseup", handleMouseUp);
  }, [pageRef, onCreate]);

  return (
    <div
      className="pointer-events-none absolute inset-0"
      style={{ zIndex: 3 }}
    >
      {highlights.map((h) => {
        const hl = h.highlight;
        if (!hl) return null;
        return (
          <div key={h.id}>
            {hl.rects.map((rect, i) => (
              <div
                key={i}
                role={rectsClickable ? "button" : undefined}
                tabIndex={rectsClickable ? 0 : -1}
                onClick={
                  rectsClickable ? () => onClickAnnotation(h.id) : undefined
                }
                onKeyDown={
                  rectsClickable
                    ? (e) => {
                        if (e.key === "Enter") onClickAnnotation(h.id);
                      }
                    : undefined
                }
                title={hl.text}
                style={{
                  position: "absolute",
                  left: `${rect.x * 100}%`,
                  top: `${rect.y * 100}%`,
                  width: `${rect.width * 100}%`,
                  height: `${rect.height * 100}%`,
                  backgroundColor: hl.color,
                  opacity: 0.4,
                  mixBlendMode: "multiply",
                  borderRadius: 2,
                  pointerEvents: rectsClickable ? "auto" : "none",
                  cursor: rectsClickable ? "pointer" : "default",
                }}
              />
            ))}
          </div>
        );
      })}
    </div>
  );
}
