import { notFound } from "next/navigation";
import { auth } from "@/auth";
import {
  canUserAccessPaper,
  getPaperById,
} from "@/lib/review-service";
import { getUserById, listAllUsers } from "@/lib/users";
import { listAnnotationsForPaper } from "@/lib/annotation-service";
import { PdfViewer } from "@/components/pdf/pdf-viewer";

interface ViewPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ assignmentId?: string }>;
}

export default async function PaperViewPage({
  params,
  searchParams,
}: ViewPageProps) {
  const session = await auth();
  if (!session?.user?.id) return null;

  const currentUser = getUserById(session.user.id);
  if (!currentUser) return null;

  const { id } = await params;
  const paper = getPaperById(id);
  if (!paper) notFound();

  if (!canUserAccessPaper(paper.id, currentUser.id, currentUser.role)) {
    notFound();
  }

  if (!paper.pdfPath && !paper.pdfUrl) notFound();

  const { assignmentId } = await searchParams;
  const initialAnnotations = listAnnotationsForPaper(
    paper.id,
    currentUser.id,
    currentUser.role
  );

  const users = listAllUsers();
  const authorNames: Record<string, string> = {};
  for (const u of users) authorNames[u.id] = u.name;

  return (
    <PdfViewer
      paperId={paper.id}
      paperTitle={paper.title}
      pdfUrl={`/api/papers/${paper.id}/pdf`}
      currentUserId={currentUser.id}
      currentUserRole={currentUser.role}
      authorNames={authorNames}
      initialAnnotations={initialAnnotations}
      assignmentId={assignmentId ?? null}
    />
  );
}
