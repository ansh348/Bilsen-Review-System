"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function VenueForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [track, setTrack] = useState("");
  const [pageLimit, setPageLimit] = useState("");
  const [abstractWordLimit, setAbstractWordLimit] = useState("");
  const [requiredSections, setRequiredSections] = useState("");
  const [referenceFormat, setReferenceFormat] = useState("");
  const [anonymityRequired, setAnonymityRequired] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const response = await fetch("/api/venues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          track: track || null,
          pageLimit: pageLimit ? Number(pageLimit) : null,
          abstractWordLimit: abstractWordLimit
            ? Number(abstractWordLimit)
            : null,
          requiredSections: requiredSections
            .split(",")
            .map((section) => section.trim())
            .filter(Boolean),
          referenceFormat: referenceFormat || null,
          anonymityRequired,
          paperTypes: ["RESEARCH"],
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(payload.error ?? "Failed to create venue");
        return;
      }

      router.push("/admin/venues");
      router.refresh();
    } catch {
      setError("Failed to create venue");
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
      <div className="space-y-2">
        <Label htmlFor="venue-name">Venue Name</Label>
        <Input
          id="venue-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="venue-track">Track</Label>
        <Input
          id="venue-track"
          value={track}
          onChange={(event) => setTrack(event.target.value)}
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="venue-page-limit">Page Limit</Label>
          <Input
            id="venue-page-limit"
            type="number"
            value={pageLimit}
            onChange={(event) => setPageLimit(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="venue-abstract-limit">Abstract Word Limit</Label>
          <Input
            id="venue-abstract-limit"
            type="number"
            value={abstractWordLimit}
            onChange={(event) => setAbstractWordLimit(event.target.value)}
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="venue-sections">Required Sections (comma-separated)</Label>
        <Textarea
          id="venue-sections"
          value={requiredSections}
          onChange={(event) => setRequiredSections(event.target.value)}
          placeholder="Abstract, Introduction, Method, Conclusion"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="venue-ref">Reference Format</Label>
        <Input
          id="venue-ref"
          value={referenceFormat}
          onChange={(event) => setReferenceFormat(event.target.value)}
        />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={anonymityRequired}
          onChange={(event) => setAnonymityRequired(event.target.checked)}
        />
        Anonymity required
      </label>
      <Button type="submit" disabled={isLoading}>
        {isLoading ? "Creating..." : "Create Venue"}
      </Button>
    </form>
  );
}
