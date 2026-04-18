"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

interface PaperComplianceRunnerProps {
  paperId: string;
}

export function PaperComplianceRunner({ paperId }: PaperComplianceRunnerProps) {
  const router = useRouter();
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runChecks() {
    setError(null);
    setIsRunning(true);
    try {
      const response = await fetch(`/api/papers/${paperId}/compliance`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(payload.error ?? "Failed to run compliance checks");
        return;
      }

      router.refresh();
    } catch {
      setError("Failed to run compliance checks");
    } finally {
      setIsRunning(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button type="button" onClick={runChecks} disabled={isRunning}>
        {isRunning ? "Running checks..." : "Run Compliance Checks"}
      </Button>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
