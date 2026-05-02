"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { VenueRequirementsPanel, type VenueRequirements } from "./venue-requirements-panel";

const MAX_FILE_BYTES = 15 * 1024 * 1024;

export interface VenueOption extends VenueRequirements {
  id: string;
  name: string;
}

interface PaperFormValues {
  title: string;
  abstractText: string | null;
  pdfUrl: string | null;
  pdfPath: string | null;
  overleafUrl: string | null;
  venueId: string | null;
  paperType: string | null;
}

interface PaperSubmissionFormProps {
  venues: VenueOption[];
  paperId?: string;
  initialValues?: Partial<PaperFormValues>;
  submitLabel?: string;
  successHref?: string;
}

interface ExtractedFields {
  sections?: string[];
  references?: string[];
  authors?: string[];
  affiliations?: string[];
  pageCount?: number;
}

interface ExtractResponse {
  uploadId: string;
  pdfPath: string;
  pageCount: number;
  extractionFailed: boolean;
  reason: string | null;
  extractedTitle: string | null;
  extractedAbstract: string | null;
  extractedAuthors: string[];
  extractedAffiliations: string[];
  extractedSections: string[];
  extractedReferences: string[];
  suggestedPaperType: string | null;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function basename(p: string | null | undefined): string | null {
  if (!p) return null;
  const parts = p.split(/[\\/]/);
  return parts[parts.length - 1] || null;
}

export function PaperSubmissionForm({
  venues,
  paperId,
  initialValues,
  submitLabel,
  successHref,
}: PaperSubmissionFormProps) {
  const router = useRouter();
  const [title, setTitle] = useState(initialValues?.title ?? "");
  const [abstractText, setAbstractText] = useState(initialValues?.abstractText ?? "");
  const [overleafUrl, setOverleafUrl] = useState(initialValues?.overleafUrl ?? "");
  const [venueId, setVenueId] = useState(initialValues?.venueId ?? "");
  const [paperType, setPaperType] = useState(initialValues?.paperType ?? "");

  const existingPdfFilename = basename(initialValues?.pdfPath ?? null);
  const existingPdfUrl = initialValues?.pdfUrl ?? null;

  const [uploadId, setUploadId] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileSize, setFileSize] = useState<number | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [extractionError, setExtractionError] = useState<string | null>(null);
  const [extractionWarning, setExtractionWarning] = useState<string | null>(null);
  const [extracted, setExtracted] = useState<ExtractedFields>({});
  const [autoFilled, setAutoFilled] = useState<{ title?: boolean; abstract?: boolean; type?: boolean }>({});
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const isEditing = Boolean(paperId);

  const selectedVenue = useMemo(
    () => venues.find((v) => v.id === venueId) ?? null,
    [venues, venueId],
  );

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  async function uploadAndExtract(file: File) {
    setExtractionError(null);
    setExtractionWarning(null);

    if (!file.name.toLowerCase().endsWith(".pdf") && file.type !== "application/pdf") {
      setExtractionError("Only PDF files are accepted.");
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setExtractionError("File exceeds the 15 MB limit.");
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setFileName(file.name);
    setFileSize(file.size);
    setExtracting(true);
    setUploadId(null);
    setExtracted({});
    setAutoFilled({});

    const formData = new FormData();
    formData.append("pdf", file);

    try {
      const response = await fetch("/api/papers/extract", {
        method: "POST",
        body: formData,
        signal: controller.signal,
      });
      const payload = (await response.json().catch(() => ({}))) as Partial<ExtractResponse> & {
        error?: string;
      };
      if (!response.ok || !payload.uploadId) {
        setExtractionError(payload.error ?? "Failed to upload PDF.");
        setFileName(null);
        setFileSize(null);
        return;
      }

      const data = payload as ExtractResponse;
      setUploadId(data.uploadId);
      setExtracted({
        sections: data.extractedSections,
        references: data.extractedReferences,
        authors: data.extractedAuthors,
        affiliations: data.extractedAffiliations,
        pageCount: data.pageCount,
      });

      const filled: typeof autoFilled = {};
      if (!title.trim() && data.extractedTitle) {
        setTitle(data.extractedTitle);
        filled.title = true;
      }
      if (!abstractText.trim() && data.extractedAbstract) {
        setAbstractText(data.extractedAbstract);
        filled.abstract = true;
      }
      if (!paperType && data.suggestedPaperType) {
        setPaperType(data.suggestedPaperType);
        filled.type = true;
      }
      setAutoFilled(filled);

      if (data.extractionFailed) {
        setExtractionWarning(
          data.reason === "scanned-or-empty"
            ? "We couldn't extract text — this PDF may be a scanned image. Please enter details manually."
            : data.reason === "encrypted"
              ? "This PDF appears to be encrypted. Please enter details manually."
              : "We couldn't auto-fill from this PDF. Please enter details manually."
        );
      } else if (Object.keys(filled).length === 0) {
        setExtractionWarning("PDF uploaded. Please review and complete the metadata.");
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setExtractionError("Upload failed. Please try again.");
      setFileName(null);
      setFileSize(null);
    } finally {
      setExtracting(false);
    }
  }

  function handleFileInput(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) {
      uploadAndExtract(file);
    }
    event.target.value = "";
  }

  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file) {
      uploadAndExtract(file);
    }
  }

  function handleDragOver(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    if (!isDragging) setIsDragging(true);
  }

  function handleDragLeave() {
    setIsDragging(false);
  }

  function clearFile() {
    abortRef.current?.abort();
    setUploadId(null);
    setFileName(null);
    setFileSize(null);
    setExtracted({});
    setAutoFilled({});
    setExtractionError(null);
    setExtractionWarning(null);
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!isEditing && !uploadId) {
      setError("Please upload a PDF before submitting.");
      return;
    }

    setIsSubmitting(true);

    const body: Record<string, unknown> = {
      title,
      abstractText: abstractText || null,
      overleafUrl: overleafUrl || null,
      venueId: venueId || null,
      paperType: paperType || null,
    };

    if (uploadId) {
      body.uploadId = uploadId;
      body.extractedSections = extracted.sections ?? [];
      body.extractedReferences = extracted.references ?? [];
      body.extractedAuthors = extracted.authors ?? [];
      body.extractedAffiliations = extracted.affiliations ?? [];
      if (extracted.pageCount && extracted.pageCount > 0) {
        body.pageCount = extracted.pageCount;
      }
    } else if (isEditing && existingPdfUrl && !existingPdfFilename) {
      // Edit case: keep existing pdfUrl unchanged (PATCH treats undefined as unchanged anyway; pass for clarity)
      body.pdfUrl = existingPdfUrl;
    }

    try {
      const response = await fetch(paperId ? `/api/papers/${paperId}` : "/api/papers", {
        method: paperId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(payload.error ?? `Failed to ${isEditing ? "update" : "submit"} paper`);
        return;
      }

      router.push(successHref ?? (paperId ? `/papers/${paperId}` : `/papers/${payload.paper.id}`));
      router.refresh();
    } catch {
      setError(`Failed to ${isEditing ? "update" : "submit"} paper`);
    } finally {
      setIsSubmitting(false);
    }
  }

  const showCurrentPdf = isEditing && !uploadId && !extracting && (existingPdfFilename || existingPdfUrl);

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {error && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
      )}

      <div className="space-y-2">
        <Label>PDF File</Label>
        {showCurrentPdf && (
          <div className="flex items-center justify-between rounded-md border border-input/90 bg-input/40 px-3 py-2 text-sm">
            <span>
              <span className="text-muted-foreground">Current PDF: </span>
              <span className="font-medium">{existingPdfFilename ?? existingPdfUrl}</span>
            </span>
            <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
              Replace PDF
            </Button>
          </div>
        )}
        {!showCurrentPdf && (
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => inputRef.current?.click()}
            className={[
              "flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-8 text-center text-sm transition-colors cursor-pointer",
              isDragging
                ? "border-ring bg-input/60"
                : extractionError
                  ? "border-destructive/60 bg-destructive/5"
                  : "border-input/90 bg-input/30 hover:bg-input/45",
            ].join(" ")}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                inputRef.current?.click();
              }
            }}
          >
            {extracting ? (
              <>
                <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-foreground/40 border-t-foreground" />
                <p className="font-medium">Extracting metadata from your PDF…</p>
                {fileName && (
                  <p className="text-xs text-muted-foreground">
                    {fileName}
                    {fileSize !== null ? ` · ${formatBytes(fileSize)}` : ""}
                  </p>
                )}
              </>
            ) : uploadId && fileName ? (
              <>
                <p className="font-medium">{fileName}</p>
                <p className="text-xs text-muted-foreground">
                  {fileSize !== null ? formatBytes(fileSize) : ""} · uploaded
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    clearFile();
                    inputRef.current?.click();
                  }}
                >
                  Replace
                </Button>
              </>
            ) : (
              <>
                <p className="font-medium">Drag &amp; drop your PDF here, or click to browse</p>
                <p className="text-xs text-muted-foreground">.pdf only · up to 15 MB</p>
              </>
            )}
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          className="hidden"
          onChange={handleFileInput}
        />
        {extractionError && (
          <p className="text-xs text-destructive">{extractionError}</p>
        )}
        {extractionWarning && !extractionError && (
          <p className="text-xs text-muted-foreground">{extractionWarning}</p>
        )}
        {uploadId && Object.keys(autoFilled).length > 0 && (
          <p className="text-xs text-muted-foreground">
            Auto-filled from PDF: {[
              autoFilled.title && "title",
              autoFilled.abstract && "abstract",
              autoFilled.type && "paper type",
            ]
              .filter(Boolean)
              .join(", ")}. Please review.
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="paper-title">
          Title{autoFilled.title && <span className="ml-2 text-xs text-muted-foreground">(auto-extracted)</span>}
        </Label>
        <Input
          id="paper-title"
          value={title}
          onChange={(event) => {
            setTitle(event.target.value);
            if (autoFilled.title) setAutoFilled((s) => ({ ...s, title: false }));
          }}
          placeholder="Paper title"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="paper-abstract">
          Abstract{autoFilled.abstract && <span className="ml-2 text-xs text-muted-foreground">(auto-extracted)</span>}
        </Label>
        <Textarea
          id="paper-abstract"
          value={abstractText}
          onChange={(event) => {
            setAbstractText(event.target.value);
            if (autoFilled.abstract) setAutoFilled((s) => ({ ...s, abstract: false }));
          }}
          placeholder="Short abstract"
          rows={5}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="paper-overleaf-url">Overleaf URL</Label>
        <Input
          id="paper-overleaf-url"
          value={overleafUrl}
          onChange={(event) => setOverleafUrl(event.target.value)}
          placeholder="https://overleaf.com/..."
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="paper-venue">Venue</Label>
          <select
            id="paper-venue"
            value={venueId}
            onChange={(event) => setVenueId(event.target.value)}
            className="h-9 w-full rounded-lg border border-input/90 bg-input/55 px-3 text-sm text-foreground shadow-[0_1px_0_rgba(255,255,255,0.03)_inset] transition-[border-color,box-shadow,background-color] outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/35"
          >
            <option value="">Select venue</option>
            {venues.map((venue) => (
              <option key={venue.id} value={venue.id}>
                {venue.name}
                {venue.track ? ` — ${venue.track}` : ""}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="paper-type">
            Paper Type
            {autoFilled.type && <span className="ml-2 text-xs text-muted-foreground">(auto-extracted)</span>}
          </Label>
          <select
            id="paper-type"
            value={paperType}
            onChange={(event) => {
              setPaperType(event.target.value);
              if (autoFilled.type) setAutoFilled((s) => ({ ...s, type: false }));
            }}
            className="h-9 w-full rounded-lg border border-input/90 bg-input/55 px-3 text-sm text-foreground shadow-[0_1px_0_rgba(255,255,255,0.03)_inset] transition-[border-color,box-shadow,background-color] outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/35"
          >
            <option value="">Auto-detect</option>
            <option value="RESEARCH">Research</option>
            <option value="SURVEY">Survey</option>
            <option value="TOOL">Tool</option>
            <option value="EXPERIENCE_REPORT">Experience Report</option>
            <option value="OTHER">Other</option>
          </select>
          <p className="text-xs text-muted-foreground">
            Leave on auto-detect to infer from the title and abstract.
          </p>
        </div>
      </div>

      {selectedVenue && (
        <VenueRequirementsPanel venue={selectedVenue} />
      )}

      <Button type="submit" disabled={isSubmitting || extracting}>
        {isSubmitting
          ? isEditing
            ? "Saving..."
            : "Submitting..."
          : submitLabel ?? (isEditing ? "Save Changes" : "Submit Paper")}
      </Button>
    </form>
  );
}
