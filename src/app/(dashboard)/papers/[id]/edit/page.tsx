import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { canUserManagePaper, getPaperDetails, listVenues } from "@/lib/review-service";
import { getUserById } from "@/lib/users";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PaperSubmissionForm } from "@/components/papers/paper-submission-form";

interface EditPaperPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditPaperPage({ params }: EditPaperPageProps) {
  const session = await auth();
  if (!session?.user?.id) {
    return null;
  }

  const currentUser = getUserById(session.user.id);
  if (!currentUser) {
    return null;
  }

  const { id } = await params;
  const details = getPaperDetails(id);
  if (!details) {
    notFound();
  }

  if (!canUserManagePaper(id, currentUser.id, currentUser.role)) {
    notFound();
  }

  const venues = listVenues().map((venue) => ({
    id: venue.id,
    name: venue.name,
  }));

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Edit Paper</h1>
          <p className="text-sm text-muted-foreground">
            Update the submission metadata, PDF URL, venue, or Overleaf link.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href={`/papers/${details.paper.id}`}>Back to paper</Link>
        </Button>
      </div>

      <Card className="border">
        <CardHeader>
          <CardTitle className="text-base">Paper Metadata</CardTitle>
        </CardHeader>
        <CardContent>
          <PaperSubmissionForm
            venues={venues}
            paperId={details.paper.id}
            successHref={`/papers/${details.paper.id}`}
            initialValues={{
              title: details.paper.title,
              abstractText: details.paper.abstractText,
              pdfUrl: details.paper.pdfUrl,
              overleafUrl: details.paper.overleafUrl,
              venueId: details.paper.venueId,
              paperType: details.paper.paperType,
            }}
            submitLabel="Save Changes"
          />
        </CardContent>
      </Card>
    </div>
  );
}
