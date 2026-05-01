"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface VenueOption {
  id: string;
  name: string;
}

interface PaperFormValues {
  title: string;
  abstractText: string | null;
  pdfUrl: string;
  overleafUrl: string | null;
  venueId: string | null;
  paperType: string | null;
}

interface PaperSubmissionFormProps {
  venues: VenueOption[];
  paperId?: string;
  initialValues?: Partial<PaperFormValues>;
  submitLabel?: string;
  successHref?: string;
}

export function PaperSubmissionForm({
  venues,
  paperId,
  initialValues,
  submitLabel,
  successHref,
}: PaperSubmissionFormProps) {
  const router = useRouter();
  const [title, setTitle] = useState(initialValues?.title ?? "");
  const [abstractText, setAbstractText] = useState(initialValues?.abstractText ?? "");
  const [pdfUrl, setPdfUrl] = useState(initialValues?.pdfUrl ?? "");
  const [overleafUrl, setOverleafUrl] = useState(initialValues?.overleafUrl ?? "");
  const [venueId, setVenueId] = useState(initialValues?.venueId ?? "");
  const [paperType, setPaperType] = useState(initialValues?.paperType ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isEditing = Boolean(paperId);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch(paperId ? `/api/papers/${paperId}` : "/api/papers", {
        method: paperId ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title,
          abstractText: abstractText || null,
          pdfUrl,
          overleafUrl: overleafUrl || null,
          venueId: venueId || null,
          paperType: paperType || null,
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(payload.error ?? `Failed to ${isEditing ? "update" : "submit"} paper`);
        return;
      }

      router.push(successHref ?? (paperId ? `/papers/${paperId}` : `/papers/${payload.paper.id}`));
      router.refresh();
    } catch {
      setError(`Failed to ${isEditing ? "update" : "submit"} paper`);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {error && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="space-y-2">
        <Label htmlFor="paper-title">Title</Label>
        <Input
          id="paper-title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Paper title"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="paper-abstract">Abstract</Label>
        <Textarea
          id="paper-abstract"
          value={abstractText}
          onChange={(event) => setAbstractText(event.target.value)}
          placeholder="Short abstract"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="paper-pdf-url">PDF URL</Label>
          <Input
            id="paper-pdf-url"
            value={pdfUrl}
            onChange={(event) => setPdfUrl(event.target.value)}
            placeholder="https://..."
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="paper-overleaf-url">Overleaf URL</Label>
          <Input
            id="paper-overleaf-url"
            value={overleafUrl}
            onChange={(event) => setOverleafUrl(event.target.value)}
            placeholder="https://overleaf.com/..."
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="paper-venue">Venue</Label>
          <select
            id="paper-venue"
            value={venueId}
            onChange={(event) => setVenueId(event.target.value)}
            className="h-9 w-full rounded-lg border border-input/90 bg-input/55 px-3 text-sm text-foreground shadow-[0_1px_0_rgba(255,255,255,0.03)_inset] transition-[border-color,box-shadow,background-color] outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/35"
          >
            <option value="">Select venue</option>
            {venues.map((venue) => (
              <option key={venue.id} value={venue.id}>
                {venue.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="paper-type">Paper Type</Label>
          <select
            id="paper-type"
            value={paperType}
            onChange={(event) => setPaperType(event.target.value)}
            className="h-9 w-full rounded-lg border border-input/90 bg-input/55 px-3 text-sm text-foreground shadow-[0_1px_0_rgba(255,255,255,0.03)_inset] transition-[border-color,box-shadow,background-color] outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/35"
          >
            <option value="">Auto-detect</option>
            <option value="RESEARCH">Research</option>
            <option value="SURVEY">Survey</option>
            <option value="TOOL">Tool</option>
            <option value="EXPERIENCE_REPORT">Experience Report</option>
            <option value="OTHER">Other</option>
          </select>
          <p className="text-xs text-muted-foreground">
            Leave this on auto-detect to infer the paper type from the title and abstract.
          </p>
        </div>
      </div>

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting
          ? isEditing
            ? "Saving..."
            : "Submitting..."
          : submitLabel ?? (isEditing ? "Save Changes" : "Submit Paper")}
      </Button>
    </form>
  );
}
