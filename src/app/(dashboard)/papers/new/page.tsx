import Link from "next/link";
import { auth } from "@/auth";
import { listVenues } from "@/lib/review-service";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PaperSubmissionForm } from "@/components/papers/paper-submission-form";

export default async function NewPaperPage() {
  const session = await auth();
  if (!session?.user?.id) {
    return null;
  }

  const venues = listVenues();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Submit New Paper</h1>
          <p className="text-sm text-muted-foreground">
            Upload metadata and start the review workflow.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/papers">Back to papers</Link>
        </Button>
      </div>

      <Card className="border">
        <CardHeader>
          <CardTitle className="text-base">Paper Metadata</CardTitle>
        </CardHeader>
        <CardContent>
          <PaperSubmissionForm venues={venues} />
        </CardContent>
      </Card>
    </div>
  );
}
