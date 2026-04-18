"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface ExtensionDecisionFormProps {
  assignmentId: string;
  requestedDate: string | null;
}

export function ExtensionDecisionForm({
  assignmentId,
  requestedDate,
}: ExtensionDecisionFormProps) {
  const router = useRouter();
  const [newDeadline, setNewDeadline] = useState(
    requestedDate ? requestedDate.slice(0, 10) : ""
  );
  const [isLoading, setIsLoading] = useState(false);

  async function submitDecision(approved: boolean) {
    setIsLoading(true);
    try {
      await fetch(`/api/assignments/${assignmentId}/extend/approve`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          newDeadline,
          approved,
        }),
      });
      router.refresh();
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex flex-wrap items-end gap-2">
      <Input
        type="date"
        value={newDeadline}
        onChange={(event) => setNewDeadline(event.target.value)}
        className="w-40"
      />
      <Button
        type="button"
        size="sm"
        onClick={() => submitDecision(true)}
        disabled={isLoading || !newDeadline}
      >
        Approve
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => submitDecision(false)}
        disabled={isLoading || !newDeadline}
      >
        Deny
      </Button>
    </div>
  );
}
