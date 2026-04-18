"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface LinkSlackFormProps {
  initialSlackId: string;
}

export function LinkSlackForm({ initialSlackId }: LinkSlackFormProps) {
  const router = useRouter();
  const [slackId, setSlackId] = useState(initialSlackId);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setIsLoading(true);

    try {
      const response = await fetch("/api/users/link-slack", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ slackId }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(payload.error ?? "Failed to link Slack");
        return;
      }
      setMessage("Slack account linked.");
      router.refresh();
    } catch {
      setError("Failed to link Slack");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
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
        <Label htmlFor="slack-id">Slack Member ID</Label>
        <Input
          id="slack-id"
          value={slackId}
          onChange={(event) => setSlackId(event.target.value)}
          placeholder="U0123456789"
          required
        />
      </div>
      <Button type="submit" disabled={isLoading}>
        {isLoading ? "Linking..." : "Link Slack"}
      </Button>
    </form>
  );
}
