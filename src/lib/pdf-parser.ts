import { PDFParse } from "pdf-parse";

export interface ExtractedPdf {
  text: string;
  pageCount: number;
}

export async function extractPdfText(buffer: Uint8Array | ArrayBuffer | Buffer): Promise<ExtractedPdf> {
  // Node's Buffer is itself a Uint8Array, so the instanceof check covers both.
  const data: Uint8Array = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);

  const parser = new PDFParse({ data });
  try {
    const result = await parser.getText();
    return {
      text: result.text ?? "",
      pageCount: result.total ?? result.pages?.length ?? 0,
    };
  } finally {
    await parser.destroy().catch(() => undefined);
  }
}

export function looksLikeScannedPdf(text: string, pageCount: number): boolean {
  if (pageCount === 0) return true;
  const charsPerPage = text.replace(/\s+/g, " ").trim().length / pageCount;
  return charsPerPage < 200;
}
