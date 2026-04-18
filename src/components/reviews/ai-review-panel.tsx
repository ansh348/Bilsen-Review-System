"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface AiReviewResult {
  summary: string;
  strengths: string[];
  concerns: string[];
  recommendation: string;
}

interface AiReviewPanelProps {
  extractedText: string;
  onApplySummary: (text: string) => void;
}

export function AiReviewPanel({ extractedText, onApplySummary }: AiReviewPanelProps) {
  const [aiReview, setAiReview] = useState<AiReviewResult | null>(null);
  const [aiSuggestions, setAiSuggestions] = useState<string[] | null>(null);
  const [loadingReview, setLoadingReview] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canRequest = extractedText.trim().length >= 20;

  async function handleGetReview() {
    setError(null);
    setLoadingReview(true);
    try {
      const res = await fetch("/api/ai/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ extractedText }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(payload.error ?? "Failed to get AI review");
        return;
      }
      setAiReview(payload.review);
    } catch {
      setError("Failed to get AI review");
    } finally {
      setLoadingReview(false);
    }
  }

  async function handleGetSuggestions() {
    setError(null);
    setLoadingSuggestions(true);
    try {
      const res = await fetch("/api/ai/suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ extractedText }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(payload.error ?? "Failed to get suggestions");
        return;
      }
      setAiSuggestions(payload.suggestions);
    } catch {
      setError("Failed to get suggestions");
    } finally {
      setLoadingSuggestions(false);
    }
  }

  function handleCopyToComments() {
    if (!aiReview) return;
    const lines = [
      `Summary: ${aiReview.summary}`,
      "",
      "Strengths:",
      ...aiReview.strengths.map((s) => `- ${s}`),
      "",
      "Concerns:",
      ...aiReview.concerns.map((c) => `- ${c}`),
      "",
      `Recommendation: ${aiReview.recommendation}`,
    ];
    onApplySummary(lines.join("\n"));
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!canRequest || loadingReview}
          onClick={handleGetReview}
        >
          {loadingReview ? "Generating..." : "Get AI Review Draft"}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!canRequest || loadingSuggestions}
          onClick={handleGetSuggestions}
        >
          {loadingSuggestions ? "Generating..." : "Get AI Suggestions"}
        </Button>
      </div>

      {!canRequest && (
        <p className="text-xs text-muted-foreground">
          Paste at least 20 characters of paper text to enable AI features.
        </p>
      )}

      {error && (
        <p className="text-xs text-destructive bg-destructive/10 rounded px-2 py-1">{error}</p>
      )}

      {aiReview && (
        <div className="rounded-md border border-border p-3 space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <p className="font-medium">AI Review Draft</p>
            <Badge variant="outline">{aiReview.recommendation}</Badge>
          </div>
          <p className="text-muted-foreground">{aiReview.summary}</p>
          <div>
            <p className="text-xs font-medium">Strengths</p>
            <ul className="ml-4 list-disc text-xs text-muted-foreground">
              {aiReview.strengths.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-xs font-medium">Concerns</p>
            <ul className="ml-4 list-disc text-xs text-muted-foreground">
              {aiReview.concerns.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={handleCopyToComments}>
            Copy to Comments
          </Button>
        </div>
      )}

      {aiSuggestions && (
        <div className="rounded-md border border-border p-3 space-y-2 text-sm">
          <p className="font-medium">AI Suggestions</p>
          <ul className="ml-4 list-disc text-xs text-muted-foreground">
            {aiSuggestions.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
