"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface RecommendationItem {
  venue: {
    id: string;
    name: string;
    track: string | null;
    submissionDeadline: string | null;
  };
  score: number;
  reasons: string[];
}

interface VenueSubmissionCardProps {
  paperId: string;
  currentVenueId: string | null;
  isSubmitted: boolean;
  submittedVenueName: string | null;
  complianceAllPassed: boolean;
  failedComplianceTypes: string[];
}

export function VenueSubmissionCard({
  paperId,
  currentVenueId,
  isSubmitted,
  submittedVenueName,
  complianceAllPassed,
  failedComplianceTypes,
}: VenueSubmissionCardProps) {
  const router = useRouter();
  const [recommendations, setRecommendations] = useState<RecommendationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const response = await fetch(`/api/papers/${paperId}/recommendations`);
        const payload = await response.json().catch(() => ({}));
        if (!cancelled && response.ok) {
          setRecommendations(payload.recommendations ?? []);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [paperId]);

  async function submitToVenue(venueId: string) {
    setError(null);
    setInfo(null);
    setSubmitting(true);
    try {
      const response = await fetch(`/api/papers/${paperId}/submit-venue`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ venueId }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (Array.isArray(payload.failedChecks)) {
          setError(
            `Cannot submit: failing compliance checks — ${payload.failedChecks
              .map((c: { checkType: string }) => c.checkType)
              .join(", ")}`,
          );
        } else {
          setError(payload.error ?? "Failed to submit");
        }
        return;
      }
      setInfo("Paper submitted to venue.");
      router.refresh();
    } catch {
      setError("Failed to submit");
    } finally {
      setSubmitting(false);
    }
  }

  if (isSubmitted) {
    return (
      <div className="rounded-md border border-emerald-500/40 bg-emerald-500/5 p-3 text-sm">
        <p className="font-medium text-emerald-600">
          Submitted to {submittedVenueName ?? "venue"}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-medium">Recommended venues</p>
        <p className="text-xs text-muted-foreground">
          Ranked by paper-type fit and topic overlap.
        </p>
      </div>
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading recommendations...</p>
      ) : recommendations.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No matching venues. Set a paper type and abstract for better recommendations.
        </p>
      ) : (
        <ul className="space-y-2">
          {recommendations.map((item) => {
            const isCurrent = item.venue.id === currentVenueId;
            const canSubmit = isCurrent && complianceAllPassed && !submitting;
            return (
              <li
                key={item.venue.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border p-3 text-sm"
              >
                <div>
                  <p className="font-medium">
                    {item.venue.name}
                    {item.venue.track && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        ({item.venue.track})
                      </span>
                    )}
                    {isCurrent && <Badge variant="outline" className="ml-2">Current venue</Badge>}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Score {item.score} - {item.reasons.join("; ")}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant={isCurrent ? "default" : "outline"}
                  disabled={!canSubmit}
                  onClick={() => submitToVenue(item.venue.id)}
                  title={
                    !isCurrent
                      ? "Switch this paper's selected venue first to submit here"
                      : !complianceAllPassed
                      ? `Failing compliance: ${failedComplianceTypes.join(", ")}`
                      : "Submit to venue"
                  }
                >
                  {isCurrent ? (submitting ? "Submitting..." : "Submit") : "Switch venue first"}
                </Button>
              </li>
            );
          })}
        </ul>
      )}
      {!complianceAllPassed && (
        <p className="text-xs text-amber-600">
          Submission gated: failing compliance checks ({failedComplianceTypes.join(", ") || "none run yet"}).
        </p>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
      {info && <p className="text-sm text-emerald-600">{info}</p>}
    </div>
  );
}
