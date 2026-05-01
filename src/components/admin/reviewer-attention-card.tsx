import Link from "next/link";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type {
  InactiveAssignmentEntry,
  OverloadedReviewerEntry,
} from "@/lib/review-service";

interface ReviewerAttentionCardProps {
  inactive: InactiveAssignmentEntry[];
  overloaded: OverloadedReviewerEntry[];
  inactivityThresholdDays: number;
  overloadThreshold: number;
}

export function ReviewerAttentionCard({
  inactive,
  overloaded,
  inactivityThresholdDays,
  overloadThreshold,
}: ReviewerAttentionCardProps) {
  const hasAny = inactive.length > 0 || overloaded.length > 0;

  return (
    <Card className={`border ${hasAny ? "border-red-500/40 bg-red-500/5" : ""}`}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          {hasAny ? (
            <AlertTriangle className="h-4 w-4 text-red-500" />
          ) : (
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          )}
          Reviewer Attention
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Stalled {`>${inactivityThresholdDays}d`} after accept, or more than {overloadThreshold} active assignments.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {!hasAny && (
          <p className="text-sm text-muted-foreground">
            No reviewers need attention right now.
          </p>
        )}

        {inactive.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Stalled after accept
            </p>
            {inactive.map((entry) => (
              <div
                key={entry.assignment.id}
                className="flex items-center justify-between rounded-md border border-border/70 bg-background/40 p-2 text-sm"
              >
                <div className="min-w-0">
                  <p className="font-medium">
                    {entry.reviewer?.name ?? "Unknown reviewer"}
                  </p>
                  <Link
                    href={`/papers/${entry.paper.id}`}
                    className="truncate text-xs text-muted-foreground hover:underline"
                  >
                    {entry.paper.title}
                  </Link>
                </div>
                <Badge
                  variant={entry.daysSinceAccepted > 7 ? "destructive" : "outline"}
                >
                  {entry.daysSinceAccepted}d since accept
                </Badge>
              </div>
            ))}
          </div>
        )}

        {overloaded.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Overloaded reviewers
            </p>
            {overloaded.map((entry) => (
              <div
                key={entry.reviewer.id}
                className="flex items-center justify-between rounded-md border border-border/70 bg-background/40 p-2 text-sm"
              >
                <div className="min-w-0">
                  <p className="font-medium">{entry.reviewer.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {entry.reviewer.email}
                  </p>
                </div>
                <Badge variant="outline" className="border-amber-500/50 text-amber-600">
                  {entry.activeCount} active
                </Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
