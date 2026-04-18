"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface RateReviewFormProps {
  reviewId: string;
}

export function RateReviewForm({ reviewId }: RateReviewFormProps) {
  const router = useRouter();
  const [quality, setQuality] = useState(3);
  const [quantity, setQuantity] = useState(3);
  const [timeliness, setTimeliness] = useState(3);
  const [comment, setComment] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);

    try {
      const res = await fetch(`/api/reviews/${reviewId}/rate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          qualityScore: quality,
          quantityScore: quantity,
          timelinessScore: timeliness,
          comment: comment.trim() || undefined,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(payload.error ?? "Failed to submit rating");
        return;
      }
      setMessage("Rating submitted.");
      router.refresh();
    } catch {
      setError("Failed to submit rating");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-2 rounded-md border border-border bg-muted/20 p-3 space-y-3">
      <p className="text-xs font-medium">Rate this review</p>
      {message && (
        <p className="text-xs text-accent-foreground bg-accent rounded px-2 py-1">{message}</p>
      )}
      {error && (
        <p className="text-xs text-destructive bg-destructive/10 rounded px-2 py-1">{error}</p>
      )}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1">
          <Label htmlFor={`quality-${reviewId}`} className="text-xs">Quality (1-5)</Label>
          <Input
            id={`quality-${reviewId}`}
            type="number"
            min={1}
            max={5}
            value={quality}
            onChange={(e) => setQuality(Number(e.target.value))}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`quantity-${reviewId}`} className="text-xs">Quantity (1-5)</Label>
          <Input
            id={`quantity-${reviewId}`}
            type="number"
            min={1}
            max={5}
            value={quantity}
            onChange={(e) => setQuantity(Number(e.target.value))}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`timeliness-${reviewId}`} className="text-xs">Timeliness (1-5)</Label>
          <Input
            id={`timeliness-${reviewId}`}
            type="number"
            min={1}
            max={5}
            value={timeliness}
            onChange={(e) => setTimeliness(Number(e.target.value))}
          />
        </div>
      </div>
      <div className="space-y-1">
        <Label htmlFor={`comment-${reviewId}`} className="text-xs">Comment (optional)</Label>
        <Textarea
          id={`comment-${reviewId}`}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Optional feedback about this review..."
          className="h-16"
        />
      </div>
      <Button type="submit" size="sm" disabled={loading}>
        {loading ? "Submitting..." : "Submit Rating"}
      </Button>
    </form>
  );
}
