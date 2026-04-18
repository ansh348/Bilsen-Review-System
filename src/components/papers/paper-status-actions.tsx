"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

interface PaperStatusActionsProps {
  paperId: string;
  currentStatus: string;
}

const statusTransitions: Record<string, Array<{ label: string; status: string; destructive?: boolean }>> = {
  SUBMITTED: [
    { label: "Begin Review", status: "UNDER_REVIEW" },
  ],
  UNDER_REVIEW: [
    { label: "Accept Paper", status: "ACCEPTED" },
    { label: "Request Revision", status: "REVISION_REQUESTED" },
    { label: "Reject Paper", status: "REJECTED", destructive: true },
  ],
  REVISION_REQUESTED: [
    { label: "Resume Review", status: "UNDER_REVIEW" },
  ],
};

export function PaperStatusActions({ paperId, currentStatus }: PaperStatusActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const actions = statusTransitions[currentStatus];
  if (!actions || actions.length === 0) return null;

  async function handleStatusChange(newStatus: string, destructive?: boolean) {
    if (destructive && !window.confirm("Are you sure? This action may be hard to undo.")) {
      return;
    }

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

  return (
    <div className="flex flex-wrap items-center gap-2">
      {actions.map((action) => (
        <Button
          key={action.status}
          variant={action.destructive ? "destructive" : "outline"}
          size="sm"
          disabled={loading}
          onClick={() => handleStatusChange(action.status, action.destructive)}
        >
          {action.label}
        </Button>
      ))}
      {error && (
        <span className="text-xs text-destructive">{error}</span>
      )}
    </div>
  );
}
