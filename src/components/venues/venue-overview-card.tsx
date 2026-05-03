import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { VenueRecord } from "@/lib/review-types";

function titleCase(value: string): string {
  return value
    .split(/[\s_-]+/)
    .map((part) => (part.length > 0 ? part[0].toUpperCase() + part.slice(1) : part))
    .join(" ");
}

interface OverviewRow {
  label: string;
  value: string | string[] | null;
}

export function VenueOverviewCard({ venue }: { venue: VenueRecord }) {
  const submissionDeadline =
    venue.submissionDeadline ?? venue.dates?.fullPaperDeadline ?? null;

  const rows: OverviewRow[] = [
    { label: "Acronym", value: venue.acronym ?? null },
    { label: "Full name", value: venue.fullName ?? null },
    { label: "Type", value: venue.type ? titleCase(venue.type) : null },
    {
      label: "Domain",
      value: venue.domain ? venue.domain.replace(/-/g, " ") : null,
    },
    { label: "Publisher", value: venue.publisher ?? null },
    {
      label: "CORE ranking",
      value: venue.coreRanking ? `CORE ${venue.coreRanking}` : null,
    },
    { label: "Edition", value: venue.edition ?? null },
    { label: "Track", value: venue.track ?? null },
    { label: "Submission deadline", value: submissionDeadline },
    {
      label: "Conference dates",
      value: venue.dates?.conferenceDates ?? null,
    },
    {
      label: "Paper types",
      value:
        venue.paperTypes && venue.paperTypes.length > 0
          ? venue.paperTypes.map((t) => titleCase(t.replace(/_/g, " ")))
          : null,
    },
  ];

  const populated = rows.filter((row) => {
    if (Array.isArray(row.value)) return row.value.length > 0;
    return row.value != null && row.value !== "";
  });

  return (
    <Card className="border">
      <CardHeader>
        <CardTitle className="text-base">Overview</CardTitle>
      </CardHeader>
      <CardContent>
        {populated.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No additional overview on file for this venue.
          </p>
        ) : (
          <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
            {populated.map((row) => (
              <div key={row.label} className="space-y-0.5">
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                  {row.label}
                </dt>
                <dd className="text-sm text-foreground">
                  {Array.isArray(row.value) ? (
                    <span className="flex flex-wrap gap-1.5">
                      {row.value.map((v) => (
                        <Badge key={v} variant="outline" className="text-[10px]">
                          {v}
                        </Badge>
                      ))}
                    </span>
                  ) : (
                    row.value
                  )}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </CardContent>
    </Card>
  );
}
