"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function RunRemindersButton() {
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function runReminders() {
    setResult(null);
    setIsRunning(true);
    try {
      const response = await fetch("/api/cron/reminders", { method: "POST" });
      const data = await response.json();
      if (!response.ok) {
        setResult(`Error: ${data.error ?? "Failed"}`);
        return;
      }
      setResult(`${data.remindersSent} reminder(s) sent, ${data.overdueMarked} marked overdue`);
    } catch {
      setResult("Failed to run reminders");
    } finally {
      setIsRunning(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <Button variant="outline" size="sm" onClick={runReminders} disabled={isRunning}>
        {isRunning ? "Running..." : "Run Reminders"}
      </Button>
      {result && <span className="text-xs text-muted-foreground">{result}</span>}
    </div>
  );
}
