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

  const sortedReviewers = useMemo(
    () =>
      [...reviewers].sort((a, b) => {
        const priorA = a.priorReviewer ? 1 : 0;
        const priorB = b.priorReviewer ? 1 : 0;
        if (priorA !== priorB) return priorA - priorB;
        return a.activeAssignments - b.activeAssignments;
      }),
    [reviewers]
  );

  function toggleReviewer(reviewerId: string) {
    setSelectedReviewerIds((current) =>
      current.includes(reviewerId)
        ? current.filter((id) => id !== reviewerId)
        : [...current, reviewerId]
    );
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

      <div className="space-y-2">
        <p className="text-sm font-medium">Select reviewers</p>
        {roundLabel && (
          <p className="text-xs text-muted-foreground">
            Assignments will be added to {roundLabel}.
          </p>
        )}
        <div className="space-y-2">
          {sortedReviewers.map((reviewer) => (
            <label
              key={reviewer.id}
              className={`flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm ${
                reviewer.priorReviewer ? "opacity-60" : ""
              }`}
            >
              <span className="flex items-center gap-2">
                <span>
                  {reviewer.name} ({reviewer.email})
                </span>
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
                  checked={selectedReviewerIds.includes(reviewer.id)}
                  onChange={() => toggleReviewer(reviewer.id)}
                />
              </span>
            </label>
          ))}
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
