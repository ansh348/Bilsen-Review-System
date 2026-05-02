import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import fs from "fs/promises";
import path from "path";
import { getAuthenticatedUser } from "@/lib/auth-helpers";
import { handleRouteError, jsonError } from "@/lib/api-route";
import { extractPdfText, looksLikeScannedPdf } from "@/lib/pdf-parser";
import { readPdfMetadata } from "@/lib/pdf-metadata";
import { extractPaperMetadata, type ExtractedPaperMetadata } from "@/lib/ai";

const MAX_FILE_BYTES = 15 * 1024 * 1024; // 15 MB
const UPLOADS_DIR = path.resolve(process.cwd(), "data", "uploads");

function regexHeuristics(text: string): Pick<ExtractedPaperMetadata, "title" | "abstract"> {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  const titleLine = lines.find((l) => l.length > 4 && l.length <= 200) ?? null;

  let abstract: string | null = null;
  const abstractMatch = text.match(
    /abstract[\s\.:\-]+([\s\S]+?)(?:\n\s*(?:1\.?\s+)?(?:introduction|keywords|index terms|categories)\b)/i
  );
  if (abstractMatch && abstractMatch[1]) {
    abstract = abstractMatch[1].replace(/\s+/g, " ").trim().slice(0, 2000) || null;
  }

  return { title: titleLine, abstract };
}

export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return jsonError("Unauthorized", 401);
    }

    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return jsonError("Expected multipart/form-data", 400);
    }

    const file = formData.get("pdf");
    if (!(file instanceof File)) {
      return jsonError("Missing 'pdf' file field", 400);
    }

    if (file.size === 0) {
      return jsonError("Uploaded file is empty", 400);
    }

    if (file.size > MAX_FILE_BYTES) {
      return jsonError("File exceeds 15 MB limit", 413);
    }

    const lowerName = (file.name ?? "").toLowerCase();
    if (!lowerName.endsWith(".pdf") && file.type !== "application/pdf") {
      return jsonError("Only PDF files are accepted", 400);
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Magic bytes: PDF files start with "%PDF-"
    if (buffer.length < 5 || buffer.slice(0, 5).toString("ascii") !== "%PDF-") {
      return jsonError("File does not appear to be a valid PDF", 400);
    }

    await fs.mkdir(UPLOADS_DIR, { recursive: true });
    const uploadId = randomUUID();
    const pdfPath = path.join(UPLOADS_DIR, `${uploadId}.pdf`);
    await fs.writeFile(pdfPath, buffer);

    let extractedText = "";
    let pageCount = 0;
    let extractionFailed = false;
    let failureReason: string | null = null;

    try {
      const result = await extractPdfText(buffer);
      extractedText = result.text;
      pageCount = result.pageCount;
      if (looksLikeScannedPdf(extractedText, pageCount)) {
        extractionFailed = true;
        failureReason = "scanned-or-empty";
      }
    } catch (error) {
      extractionFailed = true;
      failureReason = error instanceof Error && error.message.toLowerCase().includes("encrypt")
        ? "encrypted"
        : "parse-error";
    }

    // Persist text sidecar even on partial extraction so compliance can use it later.
    const txtPath = path.join(UPLOADS_DIR, `${uploadId}.txt`);
    if (extractedText) {
      await fs.writeFile(txtPath, extractedText, "utf8");
    }

    let pdfMetadata = null;
    try {
      pdfMetadata = await readPdfMetadata(buffer);
    } catch {
      // Metadata read can fail on unusual PDFs; non-blocking.
    }

    let aiMetadata: ExtractedPaperMetadata | null = null;
    if (!extractionFailed && extractedText.trim().length > 100) {
      try {
        aiMetadata = await extractPaperMetadata(extractedText);
      } catch (err) {
        console.warn("[extract route] extractPaperMetadata threw:", err instanceof Error ? err.message : String(err));
      }
    } else {
      console.log("[extract route] skipped Claude extraction", {
        extractionFailed,
        textLen: extractedText.length,
      });
    }

    console.log("[extract route]", {
      uploadId,
      extractedTextLen: extractedText.length,
      pageCount,
      extractionFailed,
      aiMetadata: aiMetadata ? "got" : "null",
      title: aiMetadata?.title?.slice(0, 60) ?? null,
    });

    let title = aiMetadata?.title ?? null;
    let abstract = aiMetadata?.abstract ?? null;
    if ((!title || !abstract) && extractedText) {
      const fallback = regexHeuristics(extractedText);
      title = title ?? fallback.title;
      abstract = abstract ?? fallback.abstract;
    }

    return NextResponse.json({
      uploadId,
      pdfPath: `data/uploads/${uploadId}.pdf`,
      pageCount,
      extractionFailed,
      reason: failureReason,
      extractedTitle: title,
      extractedAbstract: abstract,
      extractedAuthors: aiMetadata?.authors ?? [],
      extractedAffiliations: aiMetadata?.affiliations ?? [],
      extractedSections: aiMetadata?.sectionHeadings ?? [],
      extractedReferences: aiMetadata?.references ?? [],
      suggestedPaperType: aiMetadata?.suggestedPaperType ?? null,
      pdfMetadata,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
