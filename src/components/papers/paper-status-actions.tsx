"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

interface PaperStatusActionsProps {
  paperId: string;
  currentStatus: string;
}

export function PaperStatusActions({ paperId, currentStatus }: PaperStatusActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showRevisionDialog, setShowRevisionDialog] = useState(false);
  const [revisionNote, setRevisionNote] = useState("");

  async function patchStatus(newStatus: string) {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/papers/${paperId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(payload.error ?? "Failed to update status");
        return;
      }
      router.refresh();
    } catch {
      setError("Failed to update status");
    } finally {
      setLoading(false);
    }
  }

  async function confirmRevision() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/papers/${paperId}/revision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: revisionNote }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(payload.error ?? "Failed to request revision");
        return;
      }
      setShowRevisionDialog(false);
      setRevisionNote("");
      router.refresh();
    } catch {
      setError("Failed to request revision");
    } finally {
      setLoading(false);
    }
  }

  async function startNextRound() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/papers/${paperId}/rounds`, {
        method: "POST",
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(payload.error ?? "Failed to start next round");
        return;
      }
      router.push(`/admin/papers/${paperId}/assign?roundId=${payload.round.id}`);
    } catch {
      setError("Failed to start next round");
    } finally {
      setLoading(false);
    }
  }

  async function handleDestructive(label: string, newStatus: string) {
    if (!window.confirm(`${label}: this action may be hard to undo. Continue?`)) {
      return;
    }
    await patchStatus(newStatus);
  }

  const buttons: React.ReactNode[] = [];
  if (currentStatus === "SUBMITTED") {
    buttons.push(
      <Button
        key="begin"
        variant="outline"
        size="sm"
        disabled={loading}
        onClick={() => patchStatus("UNDER_REVIEW")}
      >
        Begin Review
      </Button>
    );
  } else if (
    currentStatus === "UNDER_REVIEW" ||
    currentStatus === "REVIEW_COMPLETE"
  ) {
    buttons.push(
      <Button
        key="accept"
        variant="outline"
        size="sm"
        disabled={loading}
        onClick={() => patchStatus("ACCEPTED")}
      >
        Accept Paper
      </Button>,
      <Button
        key="revision"
        variant="outline"
        size="sm"
        disabled={loading}
        onClick={() => setShowRevisionDialog(true)}
      >
        Request Revision
      </Button>,
      <Button
        key="reject"
        variant="destructive"
        size="sm"
        disabled={loading}
        onClick={() => handleDestructive("Reject Paper", "REJECTED")}
      >
        Reject Paper
      </Button>
    );
  } else if (currentStatus === "REVISION_REQUESTED") {
    buttons.push(
      <Button
        key="resume"
        variant="outline"
        size="sm"
        disabled={loading}
        onClick={() => patchStatus("UNDER_REVIEW")}
      >
        Resume Review
      </Button>,
      <Button
        key="next-round"
        variant="default"
        size="sm"
        disabled={loading}
        onClick={startNextRound}
      >
        Start next round
      </Button>
    );
  }

  if (buttons.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {buttons}
      {error && <span className="text-xs text-destructive">{error}</span>}

      {showRevisionDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4">
          <div className="w-full max-w-md space-y-3 rounded-lg border border-border bg-background p-5 shadow-lg">
            <div>
              <h3 className="text-base font-semibold">Request Revision</h3>
              <p className="text-xs text-muted-foreground">
                Share a note with the author about what needs to change. Optional.
              </p>
            </div>
            <textarea
              value={revisionNote}
              onChange={(event) => setRevisionNote(event.target.value)}
              rows={5}
              placeholder="e.g., Strengthen the evaluation section with baseline comparisons..."
              className="w-full rounded-md border border-input bg-input/40 px-3 py-2 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/35"
            />
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={loading}
                onClick={() => {
                  setShowRevisionDialog(false);
                  setRevisionNote("");
                }}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={loading}
                onClick={confirmRevision}
              >
                {loading ? "Sending..." : "Confirm revision"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
