"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

interface PaperComplianceRunnerProps {
  paperId: string;
  hasAiKey?: boolean;
  show?: "both" | "fast" | "ai";
}

export function PaperComplianceRunner({
  paperId,
  hasAiKey = false,
  show = "both",
}: PaperComplianceRunnerProps) {
  const router = useRouter();
  const [isRunning, setIsRunning] = useState<"none" | "fast" | "ai">("none");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function runFast() {
    setError(null);
    setInfo(null);
    setIsRunning("fast");
    try {
      const response = await fetch(`/api/papers/${paperId}/compliance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
      setIsRunning("none");
    }
  }

  async function runAi() {
    setError(null);
    setInfo("AI is reading the full paper and verifying references — this can take 30-60 seconds.");
    setIsRunning("ai");
    try {
      const response = await fetch(`/api/papers/${paperId}/ai-compliance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(payload.error ?? "Failed to run AI review");
        setInfo(null);
        return;
      }
      setInfo("AI review complete.");
      router.refresh();
    } catch {
      setError("Failed to run AI review");
      setInfo(null);
    } finally {
      setIsRunning("none");
    }
  }

  const showFast = show === "both" || show === "fast";
  const showAi = show === "both" || show === "ai";

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {showFast && (
          <Button type="button" onClick={runFast} disabled={isRunning !== "none"}>
            {isRunning === "fast" ? "Running checks..." : "Run Compliance Checks"}
          </Button>
        )}
        {showAi && (
          <Button
            type="button"
            variant="outline"
            onClick={runAi}
            disabled={isRunning !== "none" || !hasAiKey}
            title={hasAiKey ? "AI reads the full paper + verifies references" : "ANTHROPIC_API_KEY not configured"}
          >
            {isRunning === "ai" ? "AI is reviewing..." : "Run AI Review (paper + references)"}
          </Button>
        )}
      </div>
      {info && <p className="text-xs text-muted-foreground">{info}</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
