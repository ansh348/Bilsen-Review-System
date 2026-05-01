import { PDFDocument, StandardFonts, rgb, PDFPage, PDFFont } from "pdf-lib";

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN = 50;
const LINE_HEIGHT = 14;
const TITLE_SIZE = 18;
const HEADING_SIZE = 13;
const BODY_SIZE = 10;

interface PageContext {
  doc: PDFDocument;
  page: PDFPage;
  font: PDFFont;
  bold: PDFFont;
  cursorY: number;
}

async function newContext(doc: PDFDocument): Promise<PageContext> {
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  return { doc, page, font, bold, cursorY: PAGE_HEIGHT - MARGIN };
}

function ensureSpace(ctx: PageContext, needed: number) {
  if (ctx.cursorY - needed < MARGIN) {
    ctx.page = ctx.doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    ctx.cursorY = PAGE_HEIGHT - MARGIN;
  }
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
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
  if (current) lines.push(current);
  return lines.length > 0 ? lines : [""];
}

function sanitize(text: string): string {
  return text.replace(/[^\x00-\x7F]/g, "?");
}

function drawTitle(ctx: PageContext, text: string) {
  ensureSpace(ctx, TITLE_SIZE + 8);
  ctx.page.drawText(sanitize(text), {
    x: MARGIN,
    y: ctx.cursorY - TITLE_SIZE,
    size: TITLE_SIZE,
    font: ctx.bold,
    color: rgb(0, 0, 0),
  });
  ctx.cursorY -= TITLE_SIZE + 10;
}

function drawHeading(ctx: PageContext, text: string) {
  ensureSpace(ctx, HEADING_SIZE + 6);
  ctx.cursorY -= 6;
  ctx.page.drawText(sanitize(text), {
    x: MARGIN,
    y: ctx.cursorY - HEADING_SIZE,
    size: HEADING_SIZE,
    font: ctx.bold,
    color: rgb(0, 0, 0),
  });
  ctx.cursorY -= HEADING_SIZE + 4;
}

function drawParagraph(ctx: PageContext, text: string, opts: { bold?: boolean; size?: number } = {}) {
  const size = opts.size ?? BODY_SIZE;
  const font = opts.bold ? ctx.bold : ctx.font;
  const maxWidth = PAGE_WIDTH - 2 * MARGIN;
  const lines = wrapText(sanitize(text), font, size, maxWidth);
  for (const line of lines) {
    ensureSpace(ctx, LINE_HEIGHT);
    ctx.page.drawText(line, {
      x: MARGIN,
      y: ctx.cursorY - size,
      size,
      font,
      color: rgb(0.1, 0.1, 0.1),
    });
    ctx.cursorY -= LINE_HEIGHT;
  }
}

function drawBullet(ctx: PageContext, text: string) {
  const size = BODY_SIZE;
  const indent = 14;
  const maxWidth = PAGE_WIDTH - 2 * MARGIN - indent;
  const lines = wrapText(sanitize(text), ctx.font, size, maxWidth);
  for (let i = 0; i < lines.length; i++) {
    ensureSpace(ctx, LINE_HEIGHT);
    if (i === 0) {
      ctx.page.drawText("-", {
        x: MARGIN,
        y: ctx.cursorY - size,
        size,
        font: ctx.font,
        color: rgb(0.3, 0.3, 0.3),
      });
    }
    ctx.page.drawText(lines[i], {
      x: MARGIN + indent,
      y: ctx.cursorY - size,
      size,
      font: ctx.font,
      color: rgb(0.1, 0.1, 0.1),
    });
    ctx.cursorY -= LINE_HEIGHT;
  }
}

export async function buildAnalyticsPdf(
  title: string,
  headers: string[],
  rows: Array<Array<string | number>>,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const ctx = await newContext(doc);
  drawTitle(ctx, title);
  drawParagraph(ctx, `Generated ${new Date().toISOString().slice(0, 19).replace("T", " ")} UTC`);
  ctx.cursorY -= 8;

  for (const row of rows) {
    drawHeading(ctx, String(row[0] ?? ""));
    for (let i = 1; i < headers.length; i++) {
      const label = headers[i];
      const value = row[i];
      drawParagraph(ctx, `${label}: ${value ?? ""}`);
    }
    ctx.cursorY -= 4;
  }

  return doc.save();
}

interface FinalReportData {
  paperTitle: string;
  paperId: string;
  consensusSummary: string;
  agreedStrengths: string[];
  agreedConcerns: string[];
  divergences: string[];
  overallRecommendation: string;
  reviewerCount: number;
  unsupportedClaimCount?: number;
}

export async function buildFinalReportPdf(report: FinalReportData): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const ctx = await newContext(doc);

  drawTitle(ctx, "AI Synthesis Report");
  drawParagraph(ctx, `Paper: ${report.paperTitle}`, { bold: true });
  drawParagraph(ctx, `Paper ID: ${report.paperId}`);
  drawParagraph(ctx, `Reviewers synthesized: ${report.reviewerCount}`);
  drawParagraph(ctx, `Overall recommendation: ${report.overallRecommendation}`);
  if (report.unsupportedClaimCount !== undefined) {
    drawParagraph(
      ctx,
      `Unsupported claims flagged in source reviews: ${report.unsupportedClaimCount}`,
    );
  }

  drawHeading(ctx, "Consensus Summary");
  drawParagraph(ctx, report.consensusSummary || "No consensus summary produced.");

  drawHeading(ctx, "Agreed Strengths");
  if (report.agreedStrengths.length === 0) {
    drawParagraph(ctx, "None reported.");
  } else {
    for (const s of report.agreedStrengths) drawBullet(ctx, s);
  }

  drawHeading(ctx, "Agreed Concerns");
  if (report.agreedConcerns.length === 0) {
    drawParagraph(ctx, "None reported.");
  } else {
    for (const s of report.agreedConcerns) drawBullet(ctx, s);
  }

  drawHeading(ctx, "Reviewer Divergences");
  if (report.divergences.length === 0) {
    drawParagraph(ctx, "Reviewers were broadly aligned.");
  } else {
    for (const s of report.divergences) drawBullet(ctx, s);
  }

  return doc.save();
}

interface AnnotationItem {
  label: string;
  text: string;
  page?: number;
}

export async function buildAnnotatedPdf(
  originalPdf: Uint8Array,
  annotations: AnnotationItem[],
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(originalPdf);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const pages = doc.getPages();

  const grouped = new Map<number, AnnotationItem[]>();
  for (const ann of annotations) {
    const target = ann.page && ann.page >= 1 && ann.page <= pages.length ? ann.page : 1;
    if (!grouped.has(target)) grouped.set(target, []);
    grouped.get(target)!.push(ann);
  }

  for (const [pageIndex, items] of grouped) {
    const page = pages[pageIndex - 1];
    const { width, height } = page.getSize();
    const boxWidth = Math.min(220, width - 20);
    const lineHeight = 11;
    const padding = 6;

    const lines: Array<{ text: string; bold?: boolean }> = [];
    for (const item of items) {
      lines.push({ text: item.label, bold: true });
      const wrapped = wrapText(sanitize(item.text), font, 8, boxWidth - 2 * padding);
      for (const w of wrapped) lines.push({ text: w });
      lines.push({ text: "" });
    }
    if (lines[lines.length - 1]?.text === "") lines.pop();

    const boxHeight = lines.length * lineHeight + 2 * padding;
    const x = width - boxWidth - 10;
    const y = height - boxHeight - 10;

    page.drawRectangle({
      x,
      y,
      width: boxWidth,
      height: boxHeight,
      color: rgb(1, 0.95, 0.7),
      borderColor: rgb(0.7, 0.5, 0.1),
      borderWidth: 1,
      opacity: 0.92,
    });

    let cursor = y + boxHeight - padding - 8;
    for (const line of lines) {
      page.drawText(line.text || " ", {
        x: x + padding,
        y: cursor,
        size: 8,
        font: line.bold ? bold : font,
        color: rgb(0.15, 0.1, 0),
      });
      cursor -= lineHeight;
    }
  }

  return doc.save();
}
