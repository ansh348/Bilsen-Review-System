import Link from "next/link";
import { auth } from "@/auth";
import { getUserById } from "@/lib/users";
import { listVenues } from "@/lib/review-service";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default async function AdminVenuesPage() {
  const session = await auth();
  if (!session?.user?.id) {
    return null;
  }

  const user = getUserById(session.user.id);
  if (!user || user.role !== "COORDINATOR") {
    return null;
  }

  const venues = listVenues();

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Venues</h1>
          <p className="text-sm text-muted-foreground">
            Configure submission requirements for each venue.
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/venues/new">New Venue</Link>
        </Button>
      </div>

      <Card className="border">
        <CardHeader>
          <CardTitle className="text-base">Configured Venues</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {venues.map((venue) => (
            <div
              key={venue.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border p-4"
            >
              <div>
                <p className="text-sm font-medium">{venue.name}</p>
                <p className="text-xs text-muted-foreground">
                  {venue.track ?? "No track"} | Page limit{" "}
                  {venue.pageLimit ?? "N/A"} | Abstract limit{" "}
                  {venue.abstractWordLimit ?? "N/A"}
                </p>
              </div>
              <Badge variant={venue.anonymityRequired ? "default" : "outline"}>
                {venue.anonymityRequired ? "Anonymous" : "Non-anonymous"}
              </Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
