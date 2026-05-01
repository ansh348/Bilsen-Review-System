"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

interface AiReportActionsProps {
  paperId: string;
  hasExistingReport: boolean;
}

export function AiReportActions({ paperId, hasExistingReport }: AiReportActionsProps) {
  const router = useRouter();
  const [isGenerating, setIsGenerating] = useState(false);
  const [isAnnotating, setIsAnnotating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [extractedText, setExtractedText] = useState("");

  async function generateReport() {
    setError(null);
    setIsGenerating(true);
    try {
      const response = await fetch(`/api/papers/${paperId}/ai-report`, { method: "POST" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(payload.error ?? "Failed to generate AI report");
        return;
      }
      router.refresh();
    } catch {
      setError("Failed to generate AI report");
    } finally {
      setIsGenerating(false);
    }
  }

  async function downloadAnnotated() {
    if (extractedText.trim().length < 20) {
      setError("Paste at least 20 characters of paper text to ground annotations.");
      return;
    }
    setError(null);
    setIsAnnotating(true);
    try {
      const response = await fetch(`/api/papers/${paperId}/ai-annotated-pdf`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ extractedText }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        setError(payload.error ?? "Failed to build annotated PDF");
        return;
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `annotated-${paperId}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("Failed to build annotated PDF");
    } finally {
      setIsAnnotating(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={generateReport} disabled={isGenerating}>
          {isGenerating ? "Generating..." : hasExistingReport ? "Regenerate AI Report" : "Generate AI Synthesis Report"}
        </Button>
        {hasExistingReport && (
          <Button variant="outline" type="button" asChild>
            <a href={`/api/papers/${paperId}/ai-report/pdf`}>Download Report PDF</a>
          </Button>
        )}
      </div>
      <div className="space-y-2 rounded-md border border-border p-3">
        <p className="text-xs text-muted-foreground">
          Paste extracted paper text below, then download an annotated PDF with AI-flagged
          strengths/concerns. Unsupported claims (quotes not found in your text) are labeled.
        </p>
        <textarea
          className="w-full min-h-24 rounded-md border border-border bg-background p-2 text-xs"
          placeholder="Paste paper text..."
          value={extractedText}
          onChange={(e) => setExtractedText(e.target.value)}
        />
        <Button type="button" variant="outline" onClick={downloadAnnotated} disabled={isAnnotating}>
          {isAnnotating ? "Building PDF..." : "Download Annotated PDF"}
        </Button>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
