"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ProfileFormProps {
  userId: string;
  initialName: string;
  initialExpertise: string[];
  initialAffiliation: string | null;
}

function parseExpertise(raw: string): string[] {
  return raw
    .split(",")
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0)
    .slice(0, 15);
}

export function ProfileForm({
  userId,
  initialName,
  initialExpertise,
  initialAffiliation,
}: ProfileFormProps) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [expertiseRaw, setExpertiseRaw] = useState(initialExpertise.join(", "));
  const [affiliation, setAffiliation] = useState(initialAffiliation ?? "");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setIsLoading(true);
    try {
      const response = await fetch(`/api/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          expertise: parseExpertise(expertiseRaw),
          affiliation: affiliation.trim() === "" ? null : affiliation.trim(),
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(payload.error ?? "Failed to update profile");
        return;
      }

      setMessage("Profile updated.");
      router.refresh();
    } catch {
      setError("Failed to update profile");
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
        <Label htmlFor="profile-name">Name</Label>
        <Input
          id="profile-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="profile-expertise">Areas of expertise</Label>
        <Input
          id="profile-expertise"
          value={expertiseRaw}
          onChange={(event) => setExpertiseRaw(event.target.value)}
          placeholder="machine learning, software testing, formal methods"
        />
        <p className="text-xs text-muted-foreground">
          Comma-separated tags (max 15). Coordinators use these to match you to relevant papers.
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="profile-affiliation">Affiliation</Label>
        <Input
          id="profile-affiliation"
          value={affiliation}
          onChange={(event) => setAffiliation(event.target.value)}
          placeholder="Bilkent University"
        />
        <p className="text-xs text-muted-foreground">
          Your primary institution. Used to flag conflicts of interest when assigning reviewers.
        </p>
      </div>
      <Button type="submit" disabled={isLoading}>
        {isLoading ? "Saving..." : "Save"}
      </Button>
    </form>
  );
}
