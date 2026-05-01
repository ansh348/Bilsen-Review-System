import { PDFDocument } from "pdf-lib";

export interface PdfMetadata {
  author: string | null;
  title: string | null;
  subject: string | null;
  creator: string | null;
  producer: string | null;
  keywords: string | null;
}

function normalize(value: string | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

export async function readPdfMetadata(buffer: Uint8Array | ArrayBuffer): Promise<PdfMetadata> {
  const doc = await PDFDocument.load(buffer, { updateMetadata: false });
  const keywords = doc.getKeywords();
  return {
    author: normalize(doc.getAuthor()),
    title: normalize(doc.getTitle()),
    subject: normalize(doc.getSubject()),
    creator: normalize(doc.getCreator()),
    producer: normalize(doc.getProducer()),
    keywords: normalize(Array.isArray(keywords) ? keywords.join(", ") : (keywords as string | undefined)),
  };
}

const GENERIC_PRODUCERS = [
  "latex",
  "pdftex",
  "xelatex",
  "lualatex",
  "dvipdfmx",
  "ghostscript",
  "acrobat",
  "quartz",
  "chrome",
  "skia",
  "microsoft: print to pdf",
  "microsoft word",
  "macos",
  "tcpdf",
  "wkhtmltopdf",
];

export function metadataSuggestsIdentity(metadata: PdfMetadata): {
  hasIdentity: boolean;
  flags: string[];
} {
  const flags: string[] = [];

  if (metadata.author) {
    flags.push(`Author: ${metadata.author}`);
  }

  if (metadata.creator) {
    const lower = metadata.creator.toLowerCase();
    if (!GENERIC_PRODUCERS.some((needle) => lower.includes(needle))) {
      flags.push(`Creator: ${metadata.creator}`);
    }
  }

  return {
    hasIdentity: flags.length > 0,
    flags,
  };
}
