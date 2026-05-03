import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { getUserById } from "@/lib/users";
import { getVenueById } from "@/lib/review-service";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { VenueOverviewCard } from "@/components/venues/venue-overview-card";
import { VenueTips } from "@/components/venues/venue-tips";
import { VenueRequirementsPanel } from "@/components/papers/venue-requirements-panel";

interface VenueDetailPageProps {
  params: Promise<{ id: string }>;
}

function titleCase(value: string): string {
  return value
    .split(/[\s_-]+/)
    .map((part) => (part.length > 0 ? part[0].toUpperCase() + part.slice(1) : part))
    .join(" ");
}

export default async function VenueDetailPage({ params }: VenueDetailPageProps) {
  const session = await auth();
  if (!session?.user?.id) {
    return null;
  }

  const user = getUserById(session.user.id);
  if (!user || user.role !== "COORDINATOR") {
    return null;
  }

  const { id } = await params;
  const venue = getVenueById(id);
  if (!venue) {
    notFound();
  }

  const subtitle = venue.fullName ?? null;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h1 className="text-2xl font-semibold">{venue.name}</h1>
          {subtitle && (
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          )}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {venue.type && (
              <Badge variant="outline">{titleCase(venue.type)}</Badge>
            )}
            {venue.coreRanking && (
              <Badge variant="default">CORE {venue.coreRanking}</Badge>
            )}
            {venue.track && <Badge variant="outline">{venue.track}</Badge>}
            <Badge variant={venue.anonymityRequired ? "default" : "outline"}>
              {venue.anonymityRequired ? "Anonymous" : "Non-anonymous"}
            </Badge>
          </div>
        </div>
        <Button variant="outline" asChild>
          <Link href="/admin/venues">Back</Link>
        </Button>
      </div>

      <VenueOverviewCard venue={venue} />

      <VenueTips venue={venue} />

      <Card className="border">
        <CardHeader>
          <CardTitle className="text-base">Submission requirements</CardTitle>
        </CardHeader>
        <CardContent>
          <VenueRequirementsPanel venue={venue} defaultOpen />
        </CardContent>
      </Card>
    </div>
  );
}
