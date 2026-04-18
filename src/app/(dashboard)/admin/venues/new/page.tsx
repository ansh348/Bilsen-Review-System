import Link from "next/link";
import { auth } from "@/auth";
import { getUserById } from "@/lib/users";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { VenueForm } from "@/components/admin/venue-form";

export default async function NewVenuePage() {
  const session = await auth();
  if (!session?.user?.id) {
    return null;
  }

  const user = getUserById(session.user.id);
  if (!user || user.role !== "COORDINATOR") {
    return null;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Create Venue</h1>
          <p className="text-sm text-muted-foreground">
            Define limits and checklist requirements for submissions.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/admin/venues">Back</Link>
        </Button>
      </div>

      <Card className="border">
        <CardHeader>
          <CardTitle className="text-base">Venue Form</CardTitle>
        </CardHeader>
        <CardContent>
          <VenueForm />
        </CardContent>
      </Card>
    </div>
  );
}
