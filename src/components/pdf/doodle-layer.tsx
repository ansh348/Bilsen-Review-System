"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { getStroke } from "perfect-freehand";
import { AnnotationRecord, AnnotationStroke } from "@/lib/review-types";
import {
  DOODLE_RENDER_SCALE,
  getSvgPathFromStroke,
  Tool,
} from "@/components/pdf/utils";

interface DoodleLayerProps {
  pageRef: React.RefObject<HTMLDivElement | null>;
  tool: Tool;
  color: string;
  size: number;
  doodles: AnnotationRecord[];
  onCreate: (stroke: AnnotationStroke) => void;
  onClickAnnotation: (id: string) => void;
}

const STROKE_OPTIONS = {
  thinning: 0,
  smoothing: 0.5,
  streamline: 0.5,
  simulatePressure: false,
};

function buildPath(points: number[][], size: number, last: boolean): string {
  if (points.length < 2) return "";
  const scaled = points.map((p) => [
    p[0] * DOODLE_RENDER_SCALE,
    p[1] * DOODLE_RENDER_SCALE,
  ]);
  const outline = getStroke(scaled, {
    size: size * DOODLE_RENDER_SCALE,
    last,
    ...STROKE_OPTIONS,
  });
  const downscaled = outline.map((p) => [
    p[0] / DOODLE_RENDER_SCALE,
    p[1] / DOODLE_RENDER_SCALE,
  ]);
  return getSvgPathFromStroke(downscaled);
}

export function DoodleLayer({
  pageRef,
  tool,
  color,
  size,
  doodles,
  onCreate,
  onClickAnnotation,
}: DoodleLayerProps) {
  const active = tool === "doodle";
  const pathsClickable = tool === "cursor";
  const [currentPoints, setCurrentPoints] = useState<number[][] | null>(null);
  const drawingRef = useRef(false);

  const toNormalized = useCallback(
    (clientX: number, clientY: number) => {
      const pageNode = pageRef.current;
      if (!pageNode) return null;
      const rect = pageNode.getBoundingClientRect();
      return [
        (clientX - rect.left) / rect.width,
        (clientY - rect.top) / rect.height,
      ];
    },
    [pageRef]
  );

  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!active) return;
    const point = toNormalized(e.clientX, e.clientY);
    if (!point) return;
    drawingRef.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    setCurrentPoints([point]);
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!drawingRef.current) return;
    const point = toNormalized(e.clientX, e.clientY);
    if (!point) return;
    setCurrentPoints((prev) => (prev ? [...prev, point] : [point]));
  };

  const handlePointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    const points = currentPoints ?? [];
    setCurrentPoints(null);
    if (points.length < 2) return;
    onCreate({ points, color, size });
  };

  const renderedDoodles = useMemo(
    () =>
      doodles.flatMap((d) =>
        (d.doodle?.strokes ?? []).map((stroke, i) => ({
          key: `${d.id}-${i}`,
          path: buildPath(stroke.points, stroke.size, true),
          color: stroke.color,
          id: d.id,
        }))
      ),
    [doodles]
  );

  return (
    <svg
      className="absolute inset-0"
      width="100%"
      height="100%"
      viewBox="0 0 1 1"
      preserveAspectRatio="none"
      style={{
        zIndex: 2,
        display: "block",
        pointerEvents: active ? "auto" : "none",
        cursor: active ? "crosshair" : "default",
        touchAction: active ? "none" : "auto",
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      {renderedDoodles.map((r) => (
        <path
          key={r.key}
          d={r.path}
          fill={r.color}
          onClick={pathsClickable ? () => onClickAnnotation(r.id) : undefined}
          style={{
            cursor: pathsClickable ? "pointer" : "default",
            pointerEvents: pathsClickable ? "auto" : "none",
          }}
        />
      ))}
      {currentPoints && currentPoints.length > 1 && (
        <path
          d={buildPath(currentPoints, size, false)}
          fill={color}
          style={{ pointerEvents: "none" }}
        />
      )}
    </svg>
  );
}
