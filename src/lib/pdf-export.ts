import {
  PDFDocument,
  StandardFonts,
  rgb,
  PDFFont,
  PDFName,
  PDFArray,
  PDFRef,
  PDFPage,
} from "pdf-lib";
import type { AnnotationRecord, CommentSeverity } from "@/lib/review-types";

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace(/^#/, "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return { r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255 };
}

const SEVERITY_HEX: Record<CommentSeverity, string> = {
  CRITICAL: "#dc2626",
  MAJOR: "#ea580c",
  MINOR: "#d97706",
  SUGGESTION: "#0284c7",
  QUESTION: "#7c3aed",
};

function sanitize(text: string): string {
  // pdf-lib's StandardFonts only support WinAnsi; replace anything outside ASCII
  return text.replace(/[^\x00-\x7F]/g, "?");
}

function addLinkAnnotation(
  doc: PDFDocument,
  page: PDFPage,
  rect: [number, number, number, number],
  destPageRef: PDFRef,
  destY: number
) {
  const ctx = doc.context;
  const linkDict = ctx.obj({
    Type: "Annot",
    Subtype: "Link",
    Rect: rect,
    Border: [0, 0, 0],
    Dest: [destPageRef, "XYZ", null, destY, null],
  });
  const linkRef = ctx.register(linkDict);
  const annotsKey = PDFName.of("Annots");
  const existing = page.node.lookupMaybe(annotsKey, PDFArray);
  if (existing) {
    existing.push(linkRef);
  } else {
    page.node.set(annotsKey, ctx.obj([linkRef]));
  }
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split(/\r?\n/)) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    let current = "";
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
        current = candidate;
      } else {
        if (current) lines.push(current);
        current = word;
      }
    }
    lines.push(current);
  }
  return lines;
}

export async function buildExportPdf(
  originalPdf: Uint8Array,
  annotations: AnnotationRecord[],
  authorNames: Record<string, string>
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(originalPdf);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const pages = doc.getPages();

  const sorted = [...annotations].sort((a, b) => {
    if (a.pageNumber !== b.pageNumber) return a.pageNumber - b.pageNumber;
    return a.createdAt.localeCompare(b.createdAt);
  });

  const commentNumbers = new Map<string, number>();
  let commentCounter = 0;
  for (const a of sorted) {
    if (a.kind === "COMMENT") {
      commentCounter += 1;
      commentNumbers.set(a.id, commentCounter);
    }
  }

  const sourcePins = new Map<
    string,
    { pageIndex: number; cx: number; cy: number; pageHeight: number }
  >();
  const summaryEntries = new Map<
    string,
    { pageIndex: number; topY: number; headingRect: [number, number, number, number] }
  >();

  for (const a of sorted) {
    if (a.pageNumber < 1 || a.pageNumber > pages.length) continue;
    const page = pages[a.pageNumber - 1];
    const { width, height } = page.getSize();

    if (a.kind === "HIGHLIGHT" && a.highlight) {
      const c = hexToRgb(a.highlight.color);
      for (const r of a.highlight.rects) {
        page.drawRectangle({
          x: r.x * width,
          y: height - (r.y + r.height) * height,
          width: r.width * width,
          height: r.height * height,
          color: rgb(c.r, c.g, c.b),
          opacity: 0.35,
        });
      }
    } else if (a.kind === "DOODLE" && a.doodle) {
      for (const stroke of a.doodle.strokes) {
        const c = hexToRgb(stroke.color);
        const thickness = Math.max(1, stroke.size * width);
        for (let i = 0; i < stroke.points.length - 1; i++) {
          const [x1, y1] = stroke.points[i];
          const [x2, y2] = stroke.points[i + 1];
          page.drawLine({
            start: { x: x1 * width, y: height - y1 * height },
            end: { x: x2 * width, y: height - y2 * height },
            thickness,
            color: rgb(c.r, c.g, c.b),
            opacity: 0.95,
          });
        }
      }
    } else if (a.kind === "COMMENT" && a.comment) {
      const num = commentNumbers.get(a.id) ?? 0;
      const sev: CommentSeverity = a.comment.severity ?? "MINOR";
      const c = hexToRgb(SEVERITY_HEX[sev]);
      const cx = a.comment.anchor.x * width;
      const cy = height - a.comment.anchor.y * height;
      page.drawCircle({
        x: cx,
        y: cy,
        size: 9,
        color: rgb(c.r, c.g, c.b),
        opacity: 0.95,
      });
      const numStr = String(num);
      const numWidth = bold.widthOfTextAtSize(numStr, 9);
      page.drawText(numStr, {
        x: cx - numWidth / 2,
        y: cy - 3,
        size: 9,
        font: bold,
        color: rgb(1, 1, 1),
      });
      sourcePins.set(a.id, {
        pageIndex: a.pageNumber - 1,
        cx,
        cy,
        pageHeight: height,
      });
    }
  }

  if (commentCounter > 0) {
    const margin = 50;
    const pageWidth = 612;
    const pageHeight = 792;
    const maxWidth = pageWidth - 2 * margin;
    let summary = doc.addPage([pageWidth, pageHeight]);
    let cursorY = pageHeight - margin;

    const ensureSpace = (needed: number) => {
      if (cursorY - needed < margin) {
        summary = doc.addPage([pageWidth, pageHeight]);
        cursorY = pageHeight - margin;
      }
    };

    summary.drawText("Annotation Comments", {
      x: margin,
      y: cursorY - 18,
      size: 18,
      font: bold,
      color: rgb(0, 0, 0),
    });
    cursorY -= 30;

    for (const a of sorted) {
      if (a.kind !== "COMMENT" || !a.comment) continue;
      const num = commentNumbers.get(a.id) ?? 0;
      const sev: CommentSeverity = a.comment.severity ?? "MINOR";
      const author = authorNames[a.authorId] ?? "Unknown";
      const sevColor = hexToRgb(SEVERITY_HEX[sev]);

      ensureSpace(28);
      const entryTopY = cursorY;
      const entryPageIndex = doc.getPages().length - 1;
      summary.drawCircle({
        x: margin + 8,
        y: cursorY - 8,
        size: 8,
        color: rgb(sevColor.r, sevColor.g, sevColor.b),
      });
      const numStr = String(num);
      const numWidth = bold.widthOfTextAtSize(numStr, 8);
      summary.drawText(numStr, {
        x: margin + 8 - numWidth / 2,
        y: cursorY - 11,
        size: 8,
        font: bold,
        color: rgb(1, 1, 1),
      });
      summary.drawText(sanitize(`Page ${a.pageNumber}  -  ${sev}  -  ${author}`), {
        x: margin + 24,
        y: cursorY - 11,
        size: 11,
        font: bold,
        color: rgb(0.1, 0.1, 0.1),
      });
      summaryEntries.set(a.id, {
        pageIndex: entryPageIndex,
        topY: entryTopY,
        headingRect: [margin, cursorY - 14, margin + 320, cursorY + 2],
      });
      cursorY -= 18;

      const text = a.comment.text.trim() || "(empty comment)";
      const wrapped = wrapText(sanitize(text), font, 10, maxWidth - 24);
      for (const line of wrapped) {
        ensureSpace(13);
        summary.drawText(line, {
          x: margin + 24,
          y: cursorY - 10,
          size: 10,
          font,
          color: rgb(0.15, 0.15, 0.15),
        });
        cursorY -= 13;
      }
      cursorY -= 8;
    }
  }

  const allPages = doc.getPages();
  for (const [id, pin] of sourcePins) {
    const entry = summaryEntries.get(id);
    if (!entry) continue;
    const sourcePage = allPages[pin.pageIndex];
    const targetPage = allPages[entry.pageIndex];
    if (!sourcePage || !targetPage) continue;

    addLinkAnnotation(
      doc,
      sourcePage,
      [pin.cx - 11, pin.cy - 11, pin.cx + 11, pin.cy + 11],
      targetPage.ref,
      Math.min(targetPage.getHeight(), entry.topY + 10)
    );

    addLinkAnnotation(
      doc,
      targetPage,
      entry.headingRect,
      sourcePage.ref,
      Math.min(pin.pageHeight, pin.cy + 80)
    );
  }

  return doc.save();
}
