import { pdfjs } from "react-pdf";

if (typeof window !== "undefined") {
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
}

export type Tool = "cursor" | "highlight" | "doodle" | "comment";

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
