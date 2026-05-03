import { pdfjs } from "react-pdf";
import type { CommentSeverity } from "@/lib/review-types";

if (typeof window !== "undefined") {
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
}

export type Tool = "cursor" | "highlight" | "doodle" | "comment";

export const COMMENT_SEVERITIES: ReadonlyArray<{
  value: CommentSeverity;
  label: string;
  pillClass: string;
  pinBg: string;
  pinBorder: string;
  pinText: string;
}> = [
  {
    value: "CRITICAL",
    label: "Critical",
    pillClass: "border-red-600 bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200",
    pinBg: "bg-red-300",
    pinBorder: "border-red-700",
    pinText: "text-red-900",
  },
  {
    value: "MAJOR",
    label: "Major",
    pillClass: "border-orange-600 bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-200",
    pinBg: "bg-orange-300",
    pinBorder: "border-orange-700",
    pinText: "text-orange-900",
  },
  {
    value: "MINOR",
    label: "Minor",
    pillClass: "border-amber-600 bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
    pinBg: "bg-amber-300",
    pinBorder: "border-amber-700",
    pinText: "text-amber-900",
  },
  {
    value: "SUGGESTION",
    label: "Suggestion",
    pillClass: "border-sky-600 bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200",
    pinBg: "bg-sky-300",
    pinBorder: "border-sky-700",
    pinText: "text-sky-900",
  },
  {
    value: "QUESTION",
    label: "Question",
    pillClass: "border-violet-600 bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-200",
    pinBg: "bg-violet-300",
    pinBorder: "border-violet-700",
    pinText: "text-violet-900",
  },
];

export function severityMeta(severity: CommentSeverity | undefined) {
  return (
    COMMENT_SEVERITIES.find((s) => s.value === (severity ?? "MINOR")) ??
    COMMENT_SEVERITIES[2]
  );
}

export const HIGHLIGHT_COLORS = [
  "#ffe066",
  "#a0e7a0",
  "#a0c4ff",
  "#ffadad",
  "#d0bcff",
] as const;

export const DOODLE_COLORS = [
  "#1f1f1f",
  "#d23f3f",
  "#1d6fdc",
  "#108c45",
  "#9234d6",
] as const;

// perfect-freehand misbehaves with sub-1.0 input scales (its internal
// velocity / smoothing thresholds assume pixel-magnitude numbers), so at
// render time we project [0,1] normalized coordinates into a 1000-unit
// pseudo-pixel space, run getStroke there, and let the SVG viewBox map
// back. Storage stays normalized.
export const DOODLE_RENDER_SCALE = 1000;

export function getSvgPathFromStroke(stroke: number[][]): string {
  if (!stroke.length) return "";
  const d = stroke.reduce<(string | number)[]>(
    (acc, [x0, y0], i, arr) => {
      const [x1, y1] = arr[(i + 1) % arr.length];
      acc.push(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
      return acc;
    },
    ["M", stroke[0][0], stroke[0][1], "Q"]
  );
  d.push("Z");
  return d.join(" ");
}
