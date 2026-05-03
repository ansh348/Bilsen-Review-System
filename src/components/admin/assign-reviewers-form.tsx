"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

interface ReviewerOption {
  id: string;
  name: string;
  email: string;
  activeAssignments: number;
  priorReviewer?: boolean;
  coiReasons?: string[];
}

interface ReviewerSuggestion {
  reviewerId: string;
  rank: number;
  rationale: string;
  matchedExpertise: string[];
}

interface AssignReviewersFormProps {
  paperId: string;
  reviewers: ReviewerOption[];
  initialRoundId?: string | null;
  roundLabel?: string;
}

export function AssignReviewersForm({
  paperId,
  reviewers,
  initialRoundId = null,
  roundLabel,
}: AssignReviewersFormProps) {
  const router = useRouter();
  const [selectedReviewerIds, setSelectedReviewerIds] = useState<string[]>([]);
  const [deadline, setDeadline] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [suggestions, setSuggestions] = useState<ReviewerSuggestion[] | null>(null);
  const [suggestionsMessage, setSuggestionsMessage] = useState<string | null>(null);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [suggestError, setSuggestError] = useState<string | null>(null);

  const reviewerLookup = useMemo(
    () => new Map(reviewers.map((r) => [r.id, r])),
    [reviewers]
  );

  const sortedReviewers = useMemo(
    () =>
      [...reviewers].sort((a, b) => {
        const coiA = (a.coiReasons?.length ?? 0) > 0 ? 1 : 0;
        const coiB = (b.coiReasons?.length ?? 0) > 0 ? 1 : 0;
        if (coiA !== coiB) return coiA - coiB;
        const priorA = a.priorReviewer ? 1 : 0;
        const priorB = b.priorReviewer ? 1 : 0;
        if (priorA !== priorB) return priorA - priorB;
        return a.activeAssignments - b.activeAssignments;
      }),
    [reviewers]
  );

  function toggleReviewer(reviewerId: string) {
    const reviewer = reviewerLookup.get(reviewerId);
    if (reviewer && (reviewer.coiReasons?.length ?? 0) > 0) {
      return;
    }
    setSelectedReviewerIds((current) =>
      current.includes(reviewerId)
        ? current.filter((id) => id !== reviewerId)
        : [...current, reviewerId]
    );
  }

  async function onSuggest() {
    setSuggestError(null);
    setSuggestions(null);
    setSuggestionsMessage(null);
    setIsSuggesting(true);
    try {
      const response = await fetch(
        `/api/papers/${paperId}/suggest-reviewers`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ excludePriorReviewers: true }),
        }
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setSuggestError(payload.error ?? "Failed to fetch suggestions");
        return;
      }
      setSuggestions(payload.suggestions ?? []);
      if (payload.message) {
        setSuggestionsMessage(payload.message);
      }
    } catch {
      setSuggestError("Failed to fetch suggestions");
    } finally {
      setIsSuggesting(false);
    }
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    if (selectedReviewerIds.length === 0) {
      setError("Select at least one reviewer.");
      return;
    }

    if (!deadline) {
      setError("Select a deadline.");
      return;
    }

    setIsLoading(true);
    try {
      let roundId = initialRoundId;
      let assignedRoundLabel = roundLabel ?? "Round 1";

      if (!roundId) {
        const roundResponse = await fetch(`/api/papers/${paperId}/rounds`, {
          method: "POST",
        });
        const roundPayload = await roundResponse.json().catch(() => ({}));
        if (!roundResponse.ok) {
          setError(roundPayload.error ?? "Failed to create review round");
          return;
        }
        roundId = roundPayload.round?.id ?? null;
        assignedRoundLabel = `Round ${roundPayload.round?.roundNumber ?? 1}`;
      }

      if (!roundId) {
        setError("Failed to resolve review round");
        return;
      }

      const assignmentsResponse = await fetch(
        `/api/rounds/${roundId}/assignments`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            reviewers: selectedReviewerIds.map((reviewerId) => ({
              reviewerId,
              deadline,
            })),
          }),
        }
      );
      const assignmentPayload = await assignmentsResponse.json().catch(() => ({}));
      if (!assignmentsResponse.ok) {
        setError(assignmentPayload.error ?? "Failed to assign reviewers");
        return;
      }

      setMessage(`Reviewers assigned successfully to ${assignedRoundLabel}.`);
      setSelectedReviewerIds([]);
      setDeadline("");
      router.refresh();
    } catch {
      setError("Failed to assign reviewers");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {error && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}
      {message && (
        <p className="rounded-md bg-accent px-3 py-2 text-sm text-accent-foreground">
          {message}
        </p>
      )}

      <div className="space-y-3 rounded-md border border-border p-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-sm font-medium">AI reviewer suggestions</p>
            <p className="text-xs text-muted-foreground">
              Match this paper against members&apos; declared expertise.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={onSuggest}
            disabled={isSuggesting}
          >
            {isSuggesting ? "Thinking..." : "Suggest reviewers (AI)"}
          </Button>
        </div>

        {suggestError && (
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {suggestError}
          </p>
        )}

        {suggestions !== null && suggestions.length === 0 && (
          <p className="text-xs text-muted-foreground">
            {suggestionsMessage ??
              "No reviewers matched. Make sure members have filled in expertise tags on their profile."}
          </p>
        )}

        {suggestions && suggestions.length > 0 && (
          <ul className="space-y-2">
            {suggestions.map((suggestion) => {
              const reviewer = reviewerLookup.get(suggestion.reviewerId);
              if (!reviewer) return null;
              const isSelected = selectedReviewerIds.includes(reviewer.id);
              return (
                <li
                  key={suggestion.reviewerId}
                  className="rounded-md border border-border bg-accent/20 p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <span className="rounded-sm bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                          #{suggestion.rank}
                        </span>
                        <span>{reviewer.name}</span>
                        <span className="text-xs text-muted-foreground">
                          ({reviewer.email})
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {suggestion.rationale}
                      </p>
                      {suggestion.matchedExpertise.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {suggestion.matchedExpertise.map((tag) => (
                            <span
                              key={tag}
                              className="rounded-sm border border-border bg-background px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <Button
                      type="button"
                      variant={isSelected ? "default" : "outline"}
                      onClick={() => toggleReviewer(reviewer.id)}
                    >
                      {isSelected ? "Selected" : "Add"}
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium">Select reviewers</p>
        {roundLabel && (
          <p className="text-xs text-muted-foreground">
            Assignments will be added to {roundLabel}.
          </p>
        )}
        <div className="space-y-2">
          {sortedReviewers.map((reviewer) => {
            const hasConflict = (reviewer.coiReasons?.length ?? 0) > 0;
            const conflictTitle = reviewer.coiReasons?.join(" ") ?? "";
            return (
              <label
                key={reviewer.id}
                className={`flex items-center justify-between rounded-md border px-3 py-2 text-sm ${
                  hasConflict
                    ? "border-destructive/40 bg-destructive/5 opacity-70"
                    : reviewer.priorReviewer
                      ? "border-border opacity-60"
                      : "border-border"
                }`}
              >
                <span className="flex items-center gap-2">
                  <span>
                    {reviewer.name} ({reviewer.email})
                  </span>
                  {hasConflict && (
                    <span
                      className="rounded-sm border border-destructive/50 bg-destructive/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-destructive"
                      title={conflictTitle}
                    >
                      Conflict
                    </span>
                  )}
                  {reviewer.priorReviewer && (
                    <span
                      className="rounded-sm border border-amber-500/50 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-600"
                      title="This reviewer reviewed a prior round for this paper"
                    >
                      Prior
                    </span>
                  )}
                </span>
                <span className="flex items-center gap-4">
                  <span className="text-xs text-muted-foreground">
                    Active: {reviewer.activeAssignments}
                  </span>
                  <input
                    type="checkbox"
                    disabled={hasConflict}
                    checked={selectedReviewerIds.includes(reviewer.id)}
                    onChange={() => toggleReviewer(reviewer.id)}
                  />
                </span>
              </label>
            );
          })}
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium" htmlFor="assignment-deadline">
          Deadline
        </label>
        <input
          id="assignment-deadline"
          type="date"
          value={deadline}
          onChange={(event) => setDeadline(event.target.value)}
          className="h-9 w-full rounded-lg border border-input/90 bg-input/55 px-3 text-sm text-foreground shadow-[0_1px_0_rgba(255,255,255,0.03)_inset] transition-[border-color,box-shadow,background-color] outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/35"
        />
      </div>

      <Button type="submit" disabled={isLoading}>
        {isLoading ? "Assigning..." : "Assign Reviewers"}
      </Button>
    </form>
  );
}
