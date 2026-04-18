"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AiReviewPanel } from "@/components/reviews/ai-review-panel";

interface ReviewWorkspacePanelProps {
  assignmentId: string;
  status: string;
  initialComments: string;
  initialRecommendation: string;
  initialOverallScore: number | "";
}

const recommendationOptions = [
  "ACCEPT",
  "MINOR_REVISION",
  "MAJOR_REVISION",
  "REJECT",
];

export function ReviewWorkspacePanel({
  assignmentId,
  status,
  initialComments,
  initialRecommendation,
  initialOverallScore,
}: ReviewWorkspacePanelProps) {
  const router = useRouter();
  const [declineReason, setDeclineReason] = useState("");
  const [requestedDate, setRequestedDate] = useState("");
  const [comments, setComments] = useState(initialComments);
  const [recommendation, setRecommendation] = useState(initialRecommendation);
  const [overallScore, setOverallScore] = useState<number | "">(initialOverallScore);
  const [extractedText, setExtractedText] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const canRespond = status === "PENDING" || status === "OVERDUE";
  const canSubmitReview =
    status === "ACCEPTED" ||
    status === "IN_PROGRESS" ||
    status === "OVERDUE" ||
    status === "EXTENSION_REQUESTED" ||
    status === "COMPLETED";

  async function callApi(url: string, body: Record<string, unknown> = {}) {
    setError(null);
    setMessage(null);
    setIsLoading(true);

    try {
      const response = await fetch(url, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(payload.error ?? "Request failed");
        return false;
      }
      return true;
    } catch {
      setError("Request failed");
      return false;
    } finally {
      setIsLoading(false);
    }
  }

  async function handleAccept() {
    const ok = await callApi(`/api/assignments/${assignmentId}/accept`);
    if (!ok) return;
    setMessage("Assignment accepted.");
    router.refresh();
  }

  async function handleDecline() {
    const ok = await callApi(`/api/assignments/${assignmentId}/decline`, {
      reason: declineReason,
    });
    if (!ok) return;
    setMessage("Assignment declined.");
    setDeclineReason("");
    router.refresh();
  }

  async function handleExtension() {
    const ok = await callApi(`/api/assignments/${assignmentId}/extend`, {
      requestedDate,
    });
    if (!ok) return;
    setMessage("Extension requested.");
    setRequestedDate("");
    router.refresh();
  }

  async function handleSubmitReview(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setIsLoading(true);

    try {
      const response = await fetch(`/api/assignments/${assignmentId}/review`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          comments,
          recommendation,
          overallScore: overallScore === "" ? null : Number(overallScore),
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(payload.error ?? "Failed to submit review");
        return;
      }

      setMessage("Review submitted.");
      router.refresh();
    } catch {
      setError("Failed to submit review");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      {message && (
        <p className="rounded-md bg-accent px-3 py-2 text-sm text-accent-foreground">
          {message}
        </p>
      )}
      {error && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {canRespond && (
        <div className="space-y-3 rounded-md border border-border p-3">
          <p className="text-sm font-medium">Respond to Assignment</p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={handleAccept} disabled={isLoading}>
              Accept
            </Button>
          </div>
          <div className="space-y-2">
            <Label htmlFor="decline-reason">Decline reason</Label>
            <Textarea
              id="decline-reason"
              value={declineReason}
              onChange={(event) => setDeclineReason(event.target.value)}
              placeholder="Reason for declining"
            />
            <Button
              type="button"
              variant="outline"
              onClick={handleDecline}
              disabled={isLoading}
            >
              Decline
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-3 rounded-md border border-border p-3">
        <p className="text-sm font-medium">Request Extension</p>
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <Label htmlFor="requested-date">New deadline</Label>
            <Input
              id="requested-date"
              type="date"
              value={requestedDate}
              onChange={(event) => setRequestedDate(event.target.value)}
            />
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={handleExtension}
            disabled={isLoading || !requestedDate}
          >
            Request
          </Button>
        </div>
      </div>

      {canSubmitReview && (
        <div className="space-y-3 rounded-md border border-border p-3">
          <p className="text-sm font-medium">AI Review Assistant</p>
          <div className="space-y-1">
            <Label htmlFor="extracted-text">Paste paper text for AI analysis</Label>
            <Textarea
              id="extracted-text"
              value={extractedText}
              onChange={(e) => setExtractedText(e.target.value)}
              placeholder="Copy and paste the paper text here to use AI features..."
              className="h-24"
            />
          </div>
          <AiReviewPanel
            extractedText={extractedText}
            onApplySummary={(text) => setComments(text)}
          />
        </div>
      )}

      {canSubmitReview && (
        <form onSubmit={handleSubmitReview} className="space-y-3 rounded-md border border-border p-3">
          <p className="text-sm font-medium">Review Submission</p>
          <div className="space-y-1">
            <Label htmlFor="review-comments">Comments</Label>
            <Textarea
              id="review-comments"
              value={comments}
              onChange={(event) => setComments(event.target.value)}
              placeholder="Write your review comments..."
              required
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="review-recommendation">Recommendation</Label>
              <select
                id="review-recommendation"
                value={recommendation}
                onChange={(event) => setRecommendation(event.target.value)}
                className="h-9 w-full rounded-lg border border-input/90 bg-input/55 px-3 text-sm text-foreground shadow-[0_1px_0_rgba(255,255,255,0.03)_inset] transition-[border-color,box-shadow,background-color] outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/35"
              >
                {recommendationOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="review-score">Overall score (1-5)</Label>
              <Input
                id="review-score"
                type="number"
                min={1}
                max={5}
                value={overallScore}
                onChange={(event) =>
                  setOverallScore(event.target.value ? Number(event.target.value) : "")
                }
              />
            </div>
          </div>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? "Saving..." : "Submit Review"}
          </Button>
        </form>
      )}
    </div>
  );
}
