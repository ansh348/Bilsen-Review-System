import {
  readCollection,
  upsertCollection,
  writeCollection,
} from "@/lib/data-store";
import {
  AnalyticsPeriod,
  AssignmentStatus,
  AssignmentWithContext,
  ComplianceCheckRecord,
  ComplianceCheckType,
  NotificationRecord,
  NotificationType,
  PaperDetails,
  PaperListItem,
  PaperRecord,
  PaperType,
  PaperVersionRecord,
  Recommendation,
  Role,
  ReviewAssignmentRecord,
  ReviewerRatingRecord,
  ReviewerStats,
  ReviewRecord,
  ReviewRoundRecord,
  UserRecord,
  VenueRecord,
} from "@/lib/review-types";
import { listAllUsers, getUserById } from "@/lib/users";
import { sendNotificationEmail } from "@/lib/email";
import { promoteReviewerAnnotationsToShared } from "@/lib/annotation-service";
import { detectConflicts, summarizeConflicts } from "@/lib/coi-detection";

interface PaperFilters {
  status?: string | null;
  venueId?: string | null;
  authorId?: string | null;
}

interface PaperExtractedFields {
  pdfPath?: string | null;
  pageCount?: number | null;
  extractedSections?: string[];
  extractedReferences?: string[];
  extractedAuthors?: string[];
  extractedAffiliations?: string[];
}

interface PaperCreateInput extends PaperExtractedFields {
  title: string;
  abstractText?: string | null;
  pdfUrl?: string | null;
  overleafUrl?: string | null;
  venueId?: string | null;
  paperType?: PaperType | null;
  authorId: string;
}

interface PaperUpdateInput extends PaperExtractedFields {
  title?: string;
  abstractText?: string | null;
  pdfUrl?: string | null;
  overleafUrl?: string | null;
  venueId?: string | null;
  paperType?: PaperType | null;
  status?: PaperRecord["status"];
}

interface AssignReviewerInput {
  reviewerId: string;
  deadline: string;
}

interface ReviewSubmissionInput {
  comments: string;
  structuredFeedback?: Record<string, string> | null;
  overallScore?: number | null;
  recommendation?: Recommendation | null;
}

interface RateReviewInput {
  qualityScore: number;
  quantityScore: number;
  timelinessScore: number;
  comment?: string | null;
}

interface CreateVenueInput {
  name: string;
  track?: string | null;
  pageLimit?: number | null;
  abstractWordLimit?: number | null;
  requiredSections?: string[];
  referenceFormat?: string | null;
  anonymityRequired?: boolean;
  submissionDeadline?: string | null;
  paperTypes?: PaperType[];
}

interface ComplianceInput {
  paperId: string;
  extractedText?: string;
  pageCount?: number | null;
  metadata?: {
    author?: string | null;
    company?: string | null;
  };
  pdfBuffer?: Uint8Array | ArrayBuffer;
  extractedSections?: string[];
  extractedReferences?: string[];
}

function nowIso() {
  return new Date().toISOString();
}

function ensureUnique(values: string[]) {
  return [...new Set(values)];
}

function inferPaperType(title: string, abstractText?: string | null): PaperType | null {
  const text = `${title} ${abstractText ?? ""}`.toLowerCase();
  if (!text.trim()) {
    return null;
  }

  const hasAny = (phrases: string[]) => phrases.some((phrase) => text.includes(phrase));

  if (
    hasAny([
      "systematic review",
      "mapping study",
      "literature review",
      "survey of",
      "survey paper",
      "tertiary study",
      "state of the art",
    ])
  ) {
    return "SURVEY";
  }

  if (
    hasAny([
      "experience report",
      "lessons learned",
      "in practice",
      "industrial experience",
      "industry experience",
      "deployment experience",
      "case study",
    ])
  ) {
    return "EXPERIENCE_REPORT";
  }

  if (
    hasAny([
      "tool ",
      "tool:",
      "framework",
      "platform",
      "plugin",
      "prototype",
      "artifact",
      "extension",
      "pipeline",
    ])
  ) {
    return "TOOL";
  }

  return "RESEARCH";
}

function parseDate(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid date: ${value}`);
  }
  return parsed;
}

function isActiveAssignmentStatus(status: AssignmentStatus) {
  return (
    status === "PENDING" ||
    status === "ACCEPTED" ||
    status === "IN_PROGRESS" ||
    status === "EXTENSION_REQUESTED" ||
    status === "OVERDUE"
  );
}

const DEFAULT_VENUES: CreateVenueInput[] = [
  {
    name: "ICSE 2026",
    track: "Research Track",
    pageLimit: 10,
    abstractWordLimit: 250,
    requiredSections: ["Abstract", "Introduction", "Method", "Conclusion"],
    referenceFormat: "ACM",
    anonymityRequired: true,
    paperTypes: ["RESEARCH", "TOOL"],
  },
  {
    name: "FSE 2026",
    track: "Industry Track",
    pageLimit: 12,
    abstractWordLimit: 300,
    requiredSections: ["Abstract", "Introduction", "Approach", "Evaluation"],
    referenceFormat: "ACM",
    anonymityRequired: false,
    paperTypes: ["RESEARCH", "EXPERIENCE_REPORT"],
  },
];

export function listUsers() {
  return listAllUsers();
}

export function listVenues() {
  const existing = readCollection("venues");
  if (existing.length > 0) {
    return existing;
  }

  const seeded = DEFAULT_VENUES.map((venue) => createVenue(venue));
  return seeded;
}

export function getVenueById(venueId: string) {
  const venues = listVenues();
  return venues.find((venue) => venue.id === venueId) ?? null;
}

export function createVenue(input: CreateVenueInput) {
  const timestamp = nowIso();
  const venue: VenueRecord = {
    id: crypto.randomUUID(),
    name: input.name.trim(),
    track: input.track?.trim() || null,
    pageLimit: input.pageLimit ?? null,
    abstractWordLimit: input.abstractWordLimit ?? null,
    requiredSections:
      input.requiredSections?.map((section) => section.trim()).filter(Boolean) ??
      [],
    referenceFormat: input.referenceFormat?.trim() || null,
    anonymityRequired: input.anonymityRequired ?? false,
    submissionDeadline: input.submissionDeadline || null,
    paperTypes:
      input.paperTypes && input.paperTypes.length > 0
        ? input.paperTypes
        : ["RESEARCH"],
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  const venues = readCollection("venues");
  venues.push(venue);
  writeCollection("venues", venues);
  return venue;
}

export function updateVenue(venueId: string, input: Partial<CreateVenueInput>) {
  let updatedVenue: VenueRecord | null = null;

  upsertCollection("venues", (venues) =>
    venues.map((venue) => {
      if (venue.id !== venueId) {
        return venue;
      }

      updatedVenue = {
        ...venue,
        name: input.name?.trim() ?? venue.name,
        track:
          input.track === undefined ? venue.track : input.track?.trim() || null,
        pageLimit:
          input.pageLimit === undefined ? venue.pageLimit : input.pageLimit,
        abstractWordLimit:
          input.abstractWordLimit === undefined
            ? venue.abstractWordLimit
            : input.abstractWordLimit,
        requiredSections:
          input.requiredSections === undefined
            ? venue.requiredSections
            : input.requiredSections
                .map((section) => section.trim())
                .filter(Boolean),
        referenceFormat:
          input.referenceFormat === undefined
            ? venue.referenceFormat
            : input.referenceFormat?.trim() || null,
        anonymityRequired:
          input.anonymityRequired === undefined
            ? venue.anonymityRequired
            : input.anonymityRequired,
        submissionDeadline:
          input.submissionDeadline === undefined
            ? venue.submissionDeadline
            : input.submissionDeadline,
        paperTypes:
          input.paperTypes === undefined ? venue.paperTypes : input.paperTypes,
        updatedAt: nowIso(),
      };

      return updatedVenue;
    })
  );

  if (!updatedVenue) {
    throw new Error("Venue not found");
  }

  return updatedVenue;
}

function materializePaperListItem(paper: PaperRecord): PaperListItem {
  const venues = listVenues();
  const users = listUsers();
  const rounds = readCollection("rounds").filter(
    (round) => round.paperId === paper.id
  );
  const assignments = readCollection("assignments");

  const latestRoundNumber =
    rounds.length === 0
      ? 0
      : Math.max(...rounds.map((round) => round.roundNumber));
  const roundIds = rounds.map((round) => round.id);
  const relatedAssignments = assignments.filter((assignment) =>
    roundIds.includes(assignment.reviewRoundId)
  );

  // Get latest compliance checks for this paper
  const allChecks = readCollection("complianceChecks")
    .filter((c) => c.paperId === paper.id);
  let complianceSummary: { passed: number; total: number } | null = null;
  if (allChecks.length > 0) {
    // Group by latest timestamp to get the most recent run
    const latestTimestamp = allChecks.reduce(
      (max, c) => (c.checkedAt > max ? c.checkedAt : max),
      ""
    );
    const latestChecks = allChecks.filter((c) => c.checkedAt === latestTimestamp);
    complianceSummary = {
      passed: latestChecks.filter((c) => c.passed).length,
      total: latestChecks.length,
    };
  }

  return {
    paper,
    venue: venues.find((venue) => venue.id === paper.venueId) ?? null,
    authors: users.filter((user) => paper.authorIds.includes(user.id)),
    latestRoundNumber,
    pendingAssignments: relatedAssignments.filter((assignment) =>
      isActiveAssignmentStatus(assignment.status)
    ).length,
    completedAssignments: relatedAssignments.filter(
      (assignment) => assignment.status === "COMPLETED"
    ).length,
    complianceSummary,
  };
}

export function listPapers(filters: PaperFilters = {}) {
  const papers = readCollection("papers");
  const filtered = papers.filter((paper) => {
    if (filters.status && paper.status !== filters.status) {
      return false;
    }

    if (filters.venueId && paper.venueId !== filters.venueId) {
      return false;
    }

    if (filters.authorId && !paper.authorIds.includes(filters.authorId)) {
      return false;
    }

    return true;
  });

  return filtered
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map(materializePaperListItem);
}

// Papers that have passed AI compliance but haven't had reviewers assigned yet.
// Coordinator-facing helper for the "Awaiting Assignment" panel on the admin
// dashboard — the same papers that triggered the auto-round + nudge in
// runAiComplianceAndReferences.
export function listPapersAwaitingAssignment() {
  const papers = readCollection("papers").filter(
    (paper) => paper.status === "SUBMITTED"
  );
  if (papers.length === 0) {
    return [];
  }

  const passingPaperIds = new Set(
    readCollection("complianceChecks")
      .filter(
        (check) => check.checkType === "AI_FULL_REVIEW" && check.passed
      )
      .map((check) => check.paperId)
  );

  return papers
    .filter((paper) => passingPaperIds.has(paper.id))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map(materializePaperListItem);
}

export function createPaper(input: PaperCreateInput) {
  if (!input.title.trim()) {
    throw new Error("Paper title is required");
  }

  const trimmedPdfUrl = input.pdfUrl?.trim() || null;
  const pdfPath = input.pdfPath?.trim() || null;

  if (!trimmedPdfUrl && !pdfPath) {
    throw new Error("Either an uploaded PDF or a PDF URL is required");
  }

  if (input.venueId && !getVenueById(input.venueId)) {
    throw new Error("Selected venue does not exist");
  }

  const timestamp = nowIso();
  const title = input.title.trim();
  const abstractText = input.abstractText?.trim() || null;
  const hasExtracted =
    Boolean(input.extractedSections?.length) ||
    Boolean(input.extractedReferences?.length) ||
    Boolean(input.extractedAuthors?.length) ||
    Boolean(input.extractedAffiliations?.length);
  const paper: PaperRecord = {
    id: crypto.randomUUID(),
    title,
    abstractText,
    pdfUrl: pdfPath ? null : trimmedPdfUrl,
    pdfPath,
    pageCount: input.pageCount ?? null,
    overleafUrl: input.overleafUrl?.trim() || null,
    venueId: input.venueId || null,
    status: "SUBMITTED",
    paperType: input.paperType ?? inferPaperType(title, abstractText),
    authorIds: [input.authorId],
    extractedSections: input.extractedSections,
    extractedReferences: input.extractedReferences,
    extractedAuthors: input.extractedAuthors,
    extractedAffiliations: input.extractedAffiliations,
    extractedAt: hasExtracted ? timestamp : undefined,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  const papers = readCollection("papers");
  papers.push(paper);
  writeCollection("papers", papers);

  const coordinators = listUsers().filter((user) => user.role === "COORDINATOR");
  for (const coordinator of coordinators) {
    createNotification({
      userId: coordinator.id,
      type: "ASSIGNMENT_NEW",
      title: "New paper submitted",
      message: `"${paper.title}" was submitted and awaits reviewer assignment.`,
      link: `/papers/${paper.id}`,
      sentViaEmail: true,
      sentViaSlack: true,
    });
  }

  if (paper.venueId) {
    runComplianceChecks({ paperId: paper.id }).catch(() => { /* non-blocking */ });
  }

  return paper;
}

export function getPaperById(paperId: string) {
  const papers = readCollection("papers");
  return papers.find((paper) => paper.id === paperId) ?? null;
}

export function canUserAccessPaper(
  paperId: string,
  userId: string,
  role: Role
) {
  const paper = getPaperById(paperId);
  if (!paper) {
    return false;
  }

  if (role === "COORDINATOR") {
    return true;
  }

  if (paper.authorIds.includes(userId)) {
    return true;
  }

  const roundIds = readCollection("rounds")
    .filter((round) => round.paperId === paperId)
    .map((round) => round.id);
  if (roundIds.length === 0) {
    return false;
  }

  return readCollection("assignments").some(
    (assignment) =>
      roundIds.includes(assignment.reviewRoundId) &&
      assignment.reviewerId === userId
  );
}

export function canUserManagePaper(
  paperId: string,
  userId: string,
  role: Role
) {
  const paper = getPaperById(paperId);
  if (!paper) {
    return false;
  }

  return role === "COORDINATOR" || paper.authorIds.includes(userId);
}

export function canUserAccessReview(
  reviewId: string,
  userId: string,
  role: Role
) {
  const review = getReviewById(reviewId);
  if (!review) {
    return false;
  }

  const assignment = getAssignmentById(review.assignmentId);
  if (!assignment) {
    return false;
  }

  if (role === "COORDINATOR") {
    return true;
  }

  if (assignment.assignment.reviewerId === userId) {
    return true;
  }

  return assignment.paper.authorIds.includes(userId);
}

export function getPaperDetails(paperId: string): PaperDetails | null {
  const paper = getPaperById(paperId);
  if (!paper) {
    return null;
  }

  const users = listUsers();
  const venues = listVenues();
  const rounds = readCollection("rounds")
    .filter((round) => round.paperId === paperId)
    .sort((a, b) => a.roundNumber - b.roundNumber);
  const assignments = readCollection("assignments");
  const reviews = readCollection("reviews");
  const complianceChecks = readCollection("complianceChecks")
    .filter((check) => check.paperId === paperId)
    .sort((a, b) => b.checkedAt.localeCompare(a.checkedAt));

  const versions = readCollection("paperVersions")
    .filter((version) => version.paperId === paperId)
    .sort((a, b) => b.versionNumber - a.versionNumber);

  return {
    paper,
    authors: users.filter((user) => paper.authorIds.includes(user.id)),
    venue: venues.find((venue) => venue.id === paper.venueId) ?? null,
    rounds: rounds.map((round) => {
      const roundAssignments = assignments.filter(
        (assignment) => assignment.reviewRoundId === round.id
      );
      return {
        round,
        assignments: roundAssignments,
        reviews: reviews.filter((review) =>
          roundAssignments.some(
            (assignment) => assignment.id === review.assignmentId
          )
        ),
      };
    }),
    complianceChecks,
    versions,
  };
}

export function listPaperVersionsForPaper(paperId: string): PaperVersionRecord[] {
  return readCollection("paperVersions")
    .filter((version) => version.paperId === paperId)
    .sort((a, b) => b.versionNumber - a.versionNumber);
}

export function getPaperVersionById(
  paperId: string,
  versionId: string
): PaperVersionRecord | null {
  return (
    readCollection("paperVersions").find(
      (version) => version.id === versionId && version.paperId === paperId
    ) ?? null
  );
}

export function snapshotPaperVersion(
  paperId: string,
  reason: PaperVersionRecord["reason"] = "REVISION"
): PaperVersionRecord | null {
  const paper = getPaperById(paperId);
  if (!paper) return null;
  if (!paper.pdfPath && !paper.pdfUrl) return null;

  const existing = readCollection("paperVersions").filter(
    (version) => version.paperId === paperId
  );
  const nextVersionNumber =
    existing.reduce((max, v) => Math.max(max, v.versionNumber), 0) + 1;

  const snapshot: PaperVersionRecord = {
    id: crypto.randomUUID(),
    paperId,
    versionNumber: nextVersionNumber,
    title: paper.title,
    abstractText: paper.abstractText,
    pdfPath: paper.pdfPath ?? null,
    pdfUrl: paper.pdfUrl ?? null,
    pageCount: paper.pageCount ?? null,
    extractedSections: paper.extractedSections,
    extractedReferences: paper.extractedReferences,
    extractedAuthors: paper.extractedAuthors,
    extractedAffiliations: paper.extractedAffiliations,
    supersededAt: nowIso(),
    reason,
  };

  upsertCollection("paperVersions", (versions) => [...versions, snapshot]);
  return snapshot;
}

export function updatePaper(paperId: string, input: PaperUpdateInput) {
  let updatedPaper: PaperRecord | null = null;

  upsertCollection("papers", (papers) =>
    papers.map((paper) => {
      if (paper.id !== paperId) {
        return paper;
      }

      if (input.venueId && !getVenueById(input.venueId)) {
        throw new Error("Selected venue does not exist");
      }

      const nextTitle = input.title?.trim() ?? paper.title;
      const nextAbstractText =
        input.abstractText === undefined
          ? paper.abstractText
          : input.abstractText?.trim() || null;
      const nextPaperType =
        input.paperType === undefined
          ? paper.paperType ?? inferPaperType(nextTitle, nextAbstractText)
          : input.paperType ?? inferPaperType(nextTitle, nextAbstractText);

      const nextPdfPath =
        input.pdfPath === undefined ? paper.pdfPath ?? null : input.pdfPath?.trim() || null;
      const nextPdfUrl =
        input.pdfPath !== undefined && input.pdfPath
          ? null
          : input.pdfUrl === undefined
            ? paper.pdfUrl
            : input.pdfUrl?.trim() || null;
      const hasNewExtracted =
        input.extractedSections !== undefined ||
        input.extractedReferences !== undefined ||
        input.extractedAuthors !== undefined ||
        input.extractedAffiliations !== undefined;

      updatedPaper = {
        ...paper,
        title: nextTitle,
        abstractText: nextAbstractText,
        pdfUrl: nextPdfUrl,
        pdfPath: nextPdfPath,
        pageCount: input.pageCount === undefined ? paper.pageCount ?? null : input.pageCount,
        overleafUrl:
          input.overleafUrl === undefined
            ? paper.overleafUrl
            : input.overleafUrl?.trim() || null,
        venueId: input.venueId === undefined ? paper.venueId : input.venueId,
        status: input.status ?? paper.status,
        paperType: nextPaperType,
        extractedSections:
          input.extractedSections === undefined ? paper.extractedSections : input.extractedSections,
        extractedReferences:
          input.extractedReferences === undefined
            ? paper.extractedReferences
            : input.extractedReferences,
        extractedAuthors:
          input.extractedAuthors === undefined ? paper.extractedAuthors : input.extractedAuthors,
        extractedAffiliations:
          input.extractedAffiliations === undefined
            ? paper.extractedAffiliations
            : input.extractedAffiliations,
        extractedAt: hasNewExtracted ? nowIso() : paper.extractedAt,
        updatedAt: nowIso(),
      };

      return updatedPaper;
    })
  );

  if (!updatedPaper) {
    throw new Error("Paper not found");
  }

  const result: PaperRecord = updatedPaper;
  if (result.venueId) {
    runComplianceChecks({ paperId }).catch(() => { /* non-blocking */ });
  }

  return result;
}

export function deletePaper(paperId: string) {
  const rounds = readCollection("rounds");
  const roundIds = rounds
    .filter((round) => round.paperId === paperId)
    .map((round) => round.id);

  const assignments = readCollection("assignments");
  const assignmentIds = assignments
    .filter((assignment) => roundIds.includes(assignment.reviewRoundId))
    .map((assignment) => assignment.id);
  const reviews = readCollection("reviews");
  const reviewIds = reviews
    .filter((review) => assignmentIds.includes(review.assignmentId))
    .map((review) => review.id);

  writeCollection(
    "papers",
    readCollection("papers").filter((paper) => paper.id !== paperId)
  );
  writeCollection(
    "rounds",
    rounds.filter((round) => round.paperId !== paperId)
  );
  writeCollection(
    "assignments",
    assignments.filter((assignment) => !assignmentIds.includes(assignment.id))
  );
  writeCollection(
    "reviews",
    reviews.filter((review) => !assignmentIds.includes(review.assignmentId))
  );
  writeCollection(
    "ratings",
    readCollection("ratings").filter((rating) => !reviewIds.includes(rating.reviewId))
  );
  writeCollection(
    "complianceChecks",
    readCollection("complianceChecks").filter((check) => check.paperId !== paperId)
  );
}

function refreshOverdueAssignments() {
  const now = Date.now();
  let changed = false;

  const updated = readCollection("assignments").map((assignment) => {
    const pastDeadline = new Date(assignment.deadline).getTime() < now;
    if (
      pastDeadline &&
      assignment.status !== "DECLINED" &&
      assignment.status !== "COMPLETED" &&
      assignment.status !== "EXTENSION_REQUESTED" &&
      assignment.status !== "OVERDUE"
    ) {
      changed = true;
      return {
        ...assignment,
        status: "OVERDUE" as AssignmentStatus,
      };
    }
    return assignment;
  });

  if (changed) {
    writeCollection("assignments", updated);
  }

  return updated;
}

export function listRoundsForPaper(paperId: string) {
  return readCollection("rounds")
    .filter((round) => round.paperId === paperId)
    .sort((a, b) => a.roundNumber - b.roundNumber);
}

export function createReviewRound(paperId: string) {
  const paper = getPaperById(paperId);
  if (!paper) {
    throw new Error("Paper not found");
  }

  const rounds = listRoundsForPaper(paperId);
  const latestRound = rounds[rounds.length - 1];
  if (latestRound) {
    const latestRoundAssignments = readCollection("assignments").filter(
      (assignment) => assignment.reviewRoundId === latestRound.id
    );
    if (latestRoundAssignments.length === 0) {
      // Empty round already exists; reuse it. Status only flips to
      // UNDER_REVIEW when a real assignment is added (see assignReviewers).
      return latestRound;
    }
  }

  const nextRoundNumber =
    rounds.length === 0
      ? 1
      : Math.max(...rounds.map((round) => round.roundNumber)) + 1;

  const priorReviewerIds: string[] = [];
  if (rounds.length > 0) {
    const priorRoundIds = new Set(rounds.map((round) => round.id));
    const priorAssignments = readCollection("assignments").filter((assignment) =>
      priorRoundIds.has(assignment.reviewRoundId)
    );
    for (const assignment of priorAssignments) {
      if (!priorReviewerIds.includes(assignment.reviewerId)) {
        priorReviewerIds.push(assignment.reviewerId);
      }
    }
  }

  const round: ReviewRoundRecord = {
    id: crypto.randomUUID(),
    paperId,
    roundNumber: nextRoundNumber,
    createdAt: nowIso(),
    revisionNote: null,
    priorReviewerIds,
  };

  const allRounds = readCollection("rounds");
  allRounds.push(round);
  writeCollection("rounds", allRounds);

  // Status flip happens in assignReviewers once the round actually has work.
  return round;
}

export function markForRevision(paperId: string, note: string | null) {
  const paper = getPaperById(paperId);
  if (!paper) {
    throw new Error("Paper not found");
  }

  const trimmedNote = note?.trim() || null;

  const rounds = listRoundsForPaper(paperId);
  if (rounds.length > 0) {
    const latestRound = rounds[rounds.length - 1];
    upsertCollection("rounds", (allRounds) =>
      allRounds.map((round) =>
        round.id === latestRound.id
          ? { ...round, revisionNote: trimmedNote }
          : round
      )
    );
  }

  const updated = updatePaper(paperId, { status: "REVISION_REQUESTED" });

  for (const authorId of paper.authorIds) {
    createNotification({
      userId: authorId,
      type: "REVISION_REQUESTED",
      title: "Revision requested",
      message: trimmedNote
        ? `Your paper "${paper.title}" needs revisions. Coordinator note: ${trimmedNote}`
        : `Your paper "${paper.title}" needs revisions. Please review reviewer feedback and resubmit.`,
      link: `/papers/${paper.id}`,
      sentViaEmail: true,
      sentViaSlack: false,
    });
  }

  return updated;
}

export function getRoundDetails(paperId: string, roundId: string) {
  const round = readCollection("rounds").find(
    (candidate) => candidate.paperId === paperId && candidate.id === roundId
  );
  if (!round) {
    return null;
  }

  const assignments = refreshOverdueAssignments().filter(
    (assignment) => assignment.reviewRoundId === round.id
  );
  const reviews = readCollection("reviews").filter((review) =>
    assignments.some((assignment) => assignment.id === review.assignmentId)
  );

  return {
    round,
    assignments,
    reviews,
  };
}

export function assignReviewers(roundId: string, reviewers: AssignReviewerInput[]) {
  if (reviewers.length === 0) {
    throw new Error("At least one reviewer is required");
  }

  const round = readCollection("rounds").find((item) => item.id === roundId);
  if (!round) {
    throw new Error("Round not found");
  }

  const paper = getPaperById(round.paperId);
  if (!paper) {
    throw new Error("Paper not found");
  }

  const roundIdsForPaper = readCollection("rounds")
    .filter((item) => item.paperId === paper.id)
    .map((item) => item.id);

  const existingAssignments = refreshOverdueAssignments();
  const users = listUsers();
  const coordinatorIds = users
    .filter((user) => user.role === "COORDINATOR")
    .map((user) => user.id);

  const now = nowIso();
  const newAssignments: ReviewAssignmentRecord[] = [];
  const requestedReviewerIds = new Set<string>();

  for (const reviewerInput of reviewers) {
    const reviewer = users.find((user) => user.id === reviewerInput.reviewerId);
    if (!reviewer) {
      throw new Error(`Reviewer ${reviewerInput.reviewerId} does not exist`);
    }

    if (requestedReviewerIds.has(reviewerInput.reviewerId)) {
      throw new Error(`Reviewer ${reviewer.name} is duplicated in this request`);
    }
    requestedReviewerIds.add(reviewerInput.reviewerId);

    parseDate(reviewerInput.deadline);

    const alreadyAssignedInRound = existingAssignments.some(
      (assignment) =>
        assignment.reviewRoundId === roundId &&
        assignment.reviewerId === reviewerInput.reviewerId
    );
    if (alreadyAssignedInRound) {
      throw new Error(`Reviewer ${reviewer.name} is already assigned to this round`);
    }

    const alreadyAssignedInPaper = existingAssignments.some(
      (assignment) =>
        roundIdsForPaper.includes(assignment.reviewRoundId) &&
        assignment.reviewerId === reviewerInput.reviewerId
    );
    if (alreadyAssignedInPaper) {
      throw new Error(
        `Reviewer ${reviewer.name} was already assigned in another round for this paper`
      );
    }

    const conflicts = detectConflicts(paper, reviewer);
    if (conflicts.length > 0) {
      throw new Error(
        `Cannot assign ${reviewer.name}: conflict of interest. ${summarizeConflicts(conflicts)}`
      );
    }

    const assignment: ReviewAssignmentRecord = {
      id: crypto.randomUUID(),
      reviewRoundId: roundId,
      reviewerId: reviewerInput.reviewerId,
      deadline: reviewerInput.deadline,
      status: "PENDING",
      declineReason: null,
      extensionRequestedTo: null,
      assignedAt: now,
      respondedAt: null,
      completedAt: null,
    };
    newAssignments.push(assignment);

    const overleafLine = paper.overleafUrl ? ` Overleaf: ${paper.overleafUrl}` : "";
    createNotification({
      userId: reviewer.id,
      type: "ASSIGNMENT_NEW",
      title: "New review assignment",
      message: `You were assigned to review "${paper.title}" (round ${round.roundNumber}).${overleafLine}`,
      link: `/reviews/${assignment.id}`,
      overleafUrl: paper.overleafUrl,
      sentViaEmail: true,
      sentViaSlack: false,
    });
  }

  writeCollection("assignments", [...existingAssignments, ...newAssignments]);
  updatePaper(paper.id, { status: "UNDER_REVIEW" });

  for (const coordinatorId of coordinatorIds) {
    createNotification({
      userId: coordinatorId,
      type: "ASSIGNMENT_NEW",
      title: "Reviewers assigned",
      message: `${newAssignments.length} reviewer(s) assigned for "${paper.title}".`,
      link: `/papers/${paper.id}`,
      sentViaEmail: true,
      sentViaSlack: false,
    });
  }

  return newAssignments;
}

function materializeAssignment(assignment: ReviewAssignmentRecord): AssignmentWithContext {
  const rounds = readCollection("rounds");
  const papers = readCollection("papers");
  const users = listUsers();
  const reviews = readCollection("reviews");

  const round = rounds.find((item) => item.id === assignment.reviewRoundId);
  if (!round) {
    throw new Error("Assignment references a missing review round");
  }

  const paper = papers.find((item) => item.id === round.paperId);
  if (!paper) {
    throw new Error("Assignment references a missing paper");
  }

  return {
    assignment,
    round,
    paper,
    reviewer: users.find((user) => user.id === assignment.reviewerId) ?? null,
    review: reviews.find((review) => review.assignmentId === assignment.id) ?? null,
  };
}

export function listAssignmentsForReviewer(reviewerId: string) {
  return refreshOverdueAssignments()
    .filter((assignment) => assignment.reviewerId === reviewerId)
    .sort((a, b) => a.deadline.localeCompare(b.deadline))
    .map(materializeAssignment);
}

export function getAssignmentById(assignmentId: string) {
  const assignment = refreshOverdueAssignments().find(
    (item) => item.id === assignmentId
  );
  if (!assignment) {
    return null;
  }
  return materializeAssignment(assignment);
}

function updateAssignment(
  assignmentId: string,
  transform: (assignment: ReviewAssignmentRecord) => ReviewAssignmentRecord
) {
  let updated: ReviewAssignmentRecord | null = null;

  upsertCollection("assignments", (assignments) =>
    assignments.map((assignment) => {
      if (assignment.id !== assignmentId) {
        return assignment;
      }
      updated = transform(assignment);
      return updated;
    })
  );

  if (!updated) {
    throw new Error("Assignment not found");
  }

  return updated;
}

function getCoordinators() {
  return listUsers().filter((user) => user.role === "COORDINATOR");
}

export function acceptAssignment(assignmentId: string, reviewerId: string) {
  const materialized = getAssignmentById(assignmentId);
  if (!materialized) {
    throw new Error("Assignment not found");
  }

  if (materialized.assignment.reviewerId !== reviewerId) {
    throw new Error("You can only accept your own assignments");
  }

  const updated = updateAssignment(assignmentId, (assignment) => {
    if (assignment.status !== "PENDING" && assignment.status !== "OVERDUE") {
      throw new Error("Only pending/overdue assignments can be accepted");
    }
    return {
      ...assignment,
      status: "ACCEPTED",
      respondedAt: nowIso(),
      declineReason: null,
    };
  });

  for (const coordinator of getCoordinators()) {
    createNotification({
      userId: coordinator.id,
      type: "ASSIGNMENT_ACCEPTED",
      title: "Assignment accepted",
      message: `${materialized.reviewer?.name ?? "Reviewer"} accepted review for "${materialized.paper.title}".`,
      link: `/papers/${materialized.paper.id}`,
      sentViaEmail: true,
      sentViaSlack: false,
    });
  }

  return updated;
}

export function declineAssignment(
  assignmentId: string,
  reviewerId: string,
  reason: string
) {
  const materialized = getAssignmentById(assignmentId);
  if (!materialized) {
    throw new Error("Assignment not found");
  }

  if (materialized.assignment.reviewerId !== reviewerId) {
    throw new Error("You can only decline your own assignments");
  }

  const trimmedReason = reason.trim();
  if (!trimmedReason) {
    throw new Error("Decline reason is required");
  }

  const updated = updateAssignment(assignmentId, (assignment) => {
    if (assignment.status !== "PENDING" && assignment.status !== "OVERDUE") {
      throw new Error("Only pending/overdue assignments can be declined");
    }
    return {
      ...assignment,
      status: "DECLINED",
      declineReason: trimmedReason,
      respondedAt: nowIso(),
    };
  });

  for (const coordinator of getCoordinators()) {
    createNotification({
      userId: coordinator.id,
      type: "ASSIGNMENT_DECLINED",
      title: "Assignment declined",
      message: `${materialized.reviewer?.name ?? "Reviewer"} declined review for "${materialized.paper.title}".`,
      link: `/admin/papers/${materialized.paper.id}/assign`,
      sentViaEmail: true,
      sentViaSlack: false,
    });
  }

  return updated;
}

export function requestAssignmentExtension(
  assignmentId: string,
  reviewerId: string,
  requestedDate: string
) {
  parseDate(requestedDate);
  const materialized = getAssignmentById(assignmentId);
  if (!materialized) {
    throw new Error("Assignment not found");
  }

  if (materialized.assignment.reviewerId !== reviewerId) {
    throw new Error("You can only request an extension for your assignments");
  }

  const updated = updateAssignment(assignmentId, (assignment) => {
    if (
      assignment.status === "DECLINED" ||
      assignment.status === "COMPLETED"
    ) {
      throw new Error("Cannot request extension for completed/declined assignment");
    }
    return {
      ...assignment,
      status: "EXTENSION_REQUESTED",
      extensionRequestedTo: requestedDate,
    };
  });

  for (const coordinator of getCoordinators()) {
    createNotification({
      userId: coordinator.id,
      type: "EXTENSION_REQUESTED",
      title: "Extension requested",
      message: `${materialized.reviewer?.name ?? "Reviewer"} requested extension for "${materialized.paper.title}" to ${requestedDate}.`,
      link: `/admin/papers/${materialized.paper.id}/assign`,
      sentViaEmail: true,
      sentViaSlack: false,
    });
  }

  return updated;
}

export function approveAssignmentExtension(
  assignmentId: string,
  newDeadline: string,
  approved: boolean
) {
  if (approved) {
    parseDate(newDeadline);
  }
  const materialized = getAssignmentById(assignmentId);
  if (!materialized) {
    throw new Error("Assignment not found");
  }

  const updated = updateAssignment(assignmentId, (assignment) => {
    if (assignment.status !== "EXTENSION_REQUESTED") {
      throw new Error("Assignment has no pending extension request");
    }

    if (!approved) {
      return {
        ...assignment,
        status: "ACCEPTED",
        extensionRequestedTo: null,
      };
    }

    return {
      ...assignment,
      status: "ACCEPTED",
      deadline: newDeadline,
      extensionRequestedTo: null,
    };
  });

  createNotification({
    userId: materialized.assignment.reviewerId,
    type: approved ? "EXTENSION_APPROVED" : "EXTENSION_DENIED",
    title: approved ? "Extension approved" : "Extension denied",
    message: approved
      ? `Your extension request for "${materialized.paper.title}" was approved.`
      : `Your extension request for "${materialized.paper.title}" was denied.`,
    link: `/reviews/${materialized.assignment.id}`,
    sentViaEmail: true,
    sentViaSlack: false,
  });

  return updated;
}

function createOrUpdateReview(assignmentId: string, input: ReviewSubmissionInput) {
  const timestamp = nowIso();
  const reviews = readCollection("reviews");
  const existing = reviews.find((review) => review.assignmentId === assignmentId);

  if (!existing) {
    const created: ReviewRecord = {
      id: crypto.randomUUID(),
      assignmentId,
      comments: input.comments.trim(),
      structuredFeedback: input.structuredFeedback ?? null,
      overallScore: input.overallScore ?? null,
      recommendation: input.recommendation ?? null,
      submittedAt: timestamp,
      updatedAt: timestamp,
    };
    writeCollection("reviews", [...reviews, created]);
    return created;
  }

  const updated = {
    ...existing,
    comments: input.comments.trim(),
    structuredFeedback: input.structuredFeedback ?? existing.structuredFeedback,
    overallScore:
      input.overallScore === undefined ? existing.overallScore : input.overallScore,
    recommendation:
      input.recommendation === undefined
        ? existing.recommendation
        : input.recommendation,
    updatedAt: timestamp,
  };

  writeCollection(
    "reviews",
    reviews.map((review) => (review.id === existing.id ? updated : review))
  );
  return updated;
}

export function submitReviewForAssignment(
  assignmentId: string,
  reviewerId: string,
  input: ReviewSubmissionInput
) {
  if (!input.comments.trim()) {
    throw new Error("Review comments are required");
  }

  const materialized = getAssignmentById(assignmentId);
  if (!materialized) {
    throw new Error("Assignment not found");
  }

  if (materialized.assignment.reviewerId !== reviewerId) {
    throw new Error("You can only submit reviews for your assignments");
  }

  if (
    materialized.assignment.status === "DECLINED" ||
    materialized.assignment.status === "COMPLETED"
  ) {
    throw new Error("This assignment cannot accept new reviews");
  }

  const review = createOrUpdateReview(assignmentId, input);
  promoteReviewerAnnotationsToShared(assignmentId, review.id);
  const completedAssignment = updateAssignment(assignmentId, (assignment) => ({
    ...assignment,
    status: "COMPLETED",
    completedAt: nowIso(),
  }));

  for (const authorId of materialized.paper.authorIds) {
    createNotification({
      userId: authorId,
      type: "REVIEW_SUBMITTED",
      title: "New review submitted",
      message: `A review was submitted for "${materialized.paper.title}".`,
      link: `/papers/${materialized.paper.id}`,
      sentViaEmail: true,
      sentViaSlack: false,
    });
  }

  const roundAssignments = refreshOverdueAssignments().filter(
    (assignment) => assignment.reviewRoundId === materialized.round.id
  );
  const allDone = roundAssignments.every(
    (assignment) =>
      assignment.status === "COMPLETED" || assignment.status === "DECLINED"
  );
  if (allDone) {
    updatePaper(materialized.paper.id, { status: "REVIEW_COMPLETE" });

    const recipientIds = ensureUnique([
      ...materialized.paper.authorIds,
      ...getCoordinators().map((coordinator) => coordinator.id),
    ]);

    for (const recipientId of recipientIds) {
      createNotification({
        userId: recipientId,
        type: "ROUND_COMPLETE",
        title: "Review round completed",
        message: `All assignments in round ${materialized.round.roundNumber} for "${materialized.paper.title}" are complete.`,
        link: `/papers/${materialized.paper.id}`,
        sentViaEmail: true,
        sentViaSlack: false,
      });
    }
  }

  return {
    review,
    assignment: completedAssignment,
  };
}

export function getReviewById(reviewId: string) {
  return readCollection("reviews").find((review) => review.id === reviewId) ?? null;
}

export function updateReview(
  reviewId: string,
  reviewerId: string,
  input: Partial<ReviewSubmissionInput>
) {
  const review = getReviewById(reviewId);
  if (!review) {
    throw new Error("Review not found");
  }

  const assignment = getAssignmentById(review.assignmentId);
  if (!assignment) {
    throw new Error("Assignment not found");
  }

  if (assignment.assignment.reviewerId !== reviewerId) {
    throw new Error("You can only edit your own reviews");
  }

  const merged: ReviewSubmissionInput = {
    comments: input.comments ?? review.comments,
    structuredFeedback:
      input.structuredFeedback === undefined
        ? review.structuredFeedback
        : input.structuredFeedback,
    overallScore:
      input.overallScore === undefined ? review.overallScore : input.overallScore,
    recommendation:
      input.recommendation === undefined
        ? review.recommendation
        : input.recommendation,
  };

  return createOrUpdateReview(review.assignmentId, merged);
}

export function rateReview(
  reviewId: string,
  raterId: string,
  input: RateReviewInput
) {
  const review = getReviewById(reviewId);
  if (!review) {
    throw new Error("Review not found");
  }

  const assignment = getAssignmentById(review.assignmentId);
  if (!assignment) {
    throw new Error("Assignment not found");
  }

  if (!assignment.paper.authorIds.includes(raterId)) {
    throw new Error("Only paper authors can rate reviewers");
  }

  const validateScore = (value: number, label: string) => {
    if (value < 1 || value > 5) {
      throw new Error(`${label} score must be between 1 and 5`);
    }
  };

  validateScore(input.qualityScore, "Quality");
  validateScore(input.quantityScore, "Quantity");
  validateScore(input.timelinessScore, "Timeliness");

  const ratings = readCollection("ratings");
  const existing = ratings.find(
    (rating) => rating.reviewId === reviewId && rating.raterId === raterId
  );
  const timestamp = nowIso();

  let rating: ReviewerRatingRecord;
  if (!existing) {
    rating = {
      id: crypto.randomUUID(),
      reviewId,
      raterId,
      reviewerId: assignment.assignment.reviewerId,
      qualityScore: input.qualityScore,
      quantityScore: input.quantityScore,
      timelinessScore: input.timelinessScore,
      comment: input.comment?.trim() || null,
      createdAt: timestamp,
    };
    writeCollection("ratings", [...ratings, rating]);
  } else {
    rating = {
      ...existing,
      qualityScore: input.qualityScore,
      quantityScore: input.quantityScore,
      timelinessScore: input.timelinessScore,
      comment: input.comment?.trim() || null,
    };
    writeCollection(
      "ratings",
      ratings.map((item) => (item.id === existing.id ? rating : item))
    );
  }

  createNotification({
    userId: assignment.assignment.reviewerId,
    type: "RATING_RECEIVED",
    title: "New reviewer rating",
    message: `You received a new rating for "${assignment.paper.title}".`,
    link: `/admin/reviewers/${assignment.assignment.reviewerId}`,
    sentViaEmail: false,
    sentViaSlack: true,
  });

  return rating;
}

export function getRatingsForReviewer(reviewerId: string) {
  return readCollection("ratings")
    .filter((rating) => rating.reviewerId === reviewerId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

interface NotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string | null;
  overleafUrl?: string | null;
  sentViaEmail?: boolean;
  sentViaSlack?: boolean;
}

export function createNotification(input: NotificationInput) {
  const notification: NotificationRecord = {
    id: crypto.randomUUID(),
    userId: input.userId,
    type: input.type,
    title: input.title,
    message: input.message,
    link: input.link ?? null,
    overleafUrl: input.overleafUrl ?? null,
    read: false,
    sentViaEmail: input.sentViaEmail ?? false,
    sentViaSlack: input.sentViaSlack ?? false,
    createdAt: nowIso(),
  };

  const notifications = readCollection("notifications");
  notifications.push(notification);
  writeCollection("notifications", notifications);

  if (notification.sentViaEmail) {
    const user = getUserById(notification.userId);
    if (user) {
      sendNotificationEmail({
        to: user.email,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        link: notification.link,
        overleafUrl: notification.overleafUrl ?? null,
      }).catch(() => { /* fire-and-forget */ });
    }
  }

  return notification;
}

export function listNotificationsForUser(userId: string) {
  return readCollection("notifications")
    .filter((notification) => notification.userId === userId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function markNotificationAsRead(notificationId: string, userId: string) {
  let updated: NotificationRecord | null = null;

  upsertCollection("notifications", (notifications) =>
    notifications.map((notification) => {
      if (notification.id !== notificationId || notification.userId !== userId) {
        return notification;
      }
      updated = {
        ...notification,
        read: true,
      };
      return updated;
    })
  );

  if (!updated) {
    throw new Error("Notification not found");
  }

  return updated;
}

export function getUnreadNotificationCount(userId: string) {
  return readCollection("notifications").filter(
    (notification) => notification.userId === userId && !notification.read
  ).length;
}

export const INACTIVITY_THRESHOLD_DAYS = 5;
export const OVERLOAD_THRESHOLD = 5;

export interface InactiveAssignmentEntry {
  assignment: ReviewAssignmentRecord;
  reviewer: UserRecord | null;
  paper: PaperRecord;
  daysSinceAccepted: number;
}

export interface OverloadedReviewerEntry {
  reviewer: UserRecord;
  activeCount: number;
}

export function getInactiveAssignments(
  thresholdDays: number = INACTIVITY_THRESHOLD_DAYS
): InactiveAssignmentEntry[] {
  const assignments = refreshOverdueAssignments();
  const reviews = readCollection("reviews");
  const users = listUsers();
  const rounds = readCollection("rounds");
  const papers = readCollection("papers");
  const cutoffMs = Date.now() - thresholdDays * 24 * 60 * 60 * 1000;

  const reviewedAssignmentIds = new Set(
    reviews.map((review) => review.assignmentId)
  );

  const entries: InactiveAssignmentEntry[] = [];
  for (const assignment of assignments) {
    if (assignment.status !== "ACCEPTED") continue;
    if (!assignment.respondedAt) continue;
    if (reviewedAssignmentIds.has(assignment.id)) continue;
    const respondedMs = new Date(assignment.respondedAt).getTime();
    if (respondedMs > cutoffMs) continue;

    const round = rounds.find((item) => item.id === assignment.reviewRoundId);
    if (!round) continue;
    const paper = papers.find((item) => item.id === round.paperId);
    if (!paper) continue;

    const daysSinceAccepted = Math.floor(
      (Date.now() - respondedMs) / (24 * 60 * 60 * 1000)
    );
    entries.push({
      assignment,
      reviewer: users.find((user) => user.id === assignment.reviewerId) ?? null,
      paper,
      daysSinceAccepted,
    });
  }

  return entries.sort((a, b) => b.daysSinceAccepted - a.daysSinceAccepted);
}

export function getOverloadedReviewers(
  threshold: number = OVERLOAD_THRESHOLD
): OverloadedReviewerEntry[] {
  const assignments = refreshOverdueAssignments();
  const reviewers = listUsers().filter((user) => user.role === "MEMBER");
  const entries: OverloadedReviewerEntry[] = [];

  for (const reviewer of reviewers) {
    const activeCount = assignments.filter(
      (assignment) =>
        assignment.reviewerId === reviewer.id &&
        isActiveAssignmentStatus(assignment.status)
    ).length;
    if (activeCount > threshold) {
      entries.push({ reviewer, activeCount });
    }
  }

  return entries.sort((a, b) => b.activeCount - a.activeCount);
}

export function getOverviewAnalytics() {
  const assignments = refreshOverdueAssignments();
  const papers = readCollection("papers");
  const now = Date.now();
  const sevenDaysFromNow = now + 7 * 24 * 60 * 60 * 1000;

  return {
    totalPapers: papers.length,
    activePapers: papers.filter(
      (paper) =>
        paper.status === "UNDER_REVIEW" || paper.status === "REVIEW_COMPLETE"
    ).length,
    pendingReviews: assignments.filter((assignment) =>
      isActiveAssignmentStatus(assignment.status)
    ).length,
    overdueAssignments: assignments.filter(
      (assignment) => assignment.status === "OVERDUE"
    ).length,
    completedReviews: assignments.filter(
      (assignment) => assignment.status === "COMPLETED"
    ).length,
    upcomingDeadlines: assignments.filter((assignment) => {
      const deadline = new Date(assignment.deadline).getTime();
      return (
        deadline >= now &&
        deadline <= sevenDaysFromNow &&
        isActiveAssignmentStatus(assignment.status)
      );
    }).length,
  };
}

function getDateRangeStart(period: AnalyticsPeriod): Date | null {
  if (period === "overall") return null;
  const now = Date.now();
  if (period === "monthly") return new Date(now - 30 * 24 * 60 * 60 * 1000);
  return new Date(now - 365 * 24 * 60 * 60 * 1000); // yearly
}

function isWithinPeriod(dateStr: string, start: Date | null): boolean {
  if (!start) return true;
  return new Date(dateStr) >= start;
}

function buildReviewerStats(reviewer: UserRecord, period: AnalyticsPeriod = "overall"): ReviewerStats {
  const periodStart = getDateRangeStart(period);
  const assignments = refreshOverdueAssignments().filter(
    (assignment) => assignment.reviewerId === reviewer.id && isWithinPeriod(assignment.assignedAt, periodStart)
  );
  const ratings = getRatingsForReviewer(reviewer.id).filter(
    (rating) => isWithinPeriod(rating.createdAt, periodStart)
  );
  const completedAssignments = assignments.filter(
    (assignment) => assignment.status === "COMPLETED"
  );
  const acceptedAssignments = assignments.filter(
    (assignment) =>
      assignment.status === "ACCEPTED" ||
      assignment.status === "IN_PROGRESS" ||
      assignment.status === "COMPLETED"
  );
  const declinedAssignments = assignments.filter(
    (assignment) => assignment.status === "DECLINED"
  );
  const overdueAssignments = assignments.filter(
    (assignment) => assignment.status === "OVERDUE"
  );
  const onTimeCompleted = completedAssignments.filter((assignment) => {
    if (!assignment.completedAt) {
      return false;
    }
    return new Date(assignment.completedAt) <= new Date(assignment.deadline);
  });

  const average = (values: number[]) => {
    if (values.length === 0) {
      return 0;
    }
    return Number(
      (values.reduce((sum, current) => sum + current, 0) / values.length).toFixed(2)
    );
  };

  const averageQuality = average(ratings.map((rating) => rating.qualityScore));
  const averageQuantity = average(ratings.map((rating) => rating.quantityScore));
  const averageTimeliness = average(ratings.map((rating) => rating.timelinessScore));

  return {
    reviewer,
    activeAssignments: assignments.filter((assignment) =>
      isActiveAssignmentStatus(assignment.status)
    ).length,
    totalAssignments: assignments.length,
    acceptedAssignments: acceptedAssignments.length,
    declinedAssignments: declinedAssignments.length,
    completedAssignments: completedAssignments.length,
    overdueAssignments: overdueAssignments.length,
    acceptanceRate:
      assignments.length === 0
        ? 0
        : Number(((acceptedAssignments.length / assignments.length) * 100).toFixed(2)),
    onTimeRate:
      completedAssignments.length === 0
        ? 0
        : Number(
            ((onTimeCompleted.length / completedAssignments.length) * 100).toFixed(2)
          ),
    averageQuality,
    averageQuantity,
    averageTimeliness,
    averageOverallRating: average([
      ...ratings.map((rating) => rating.qualityScore),
      ...ratings.map((rating) => rating.quantityScore),
      ...ratings.map((rating) => rating.timelinessScore),
    ]),
  };
}

export function getWorkloadAnalytics(period: AnalyticsPeriod = "overall") {
  const users = listUsers().filter((user) => user.role === "MEMBER");
  return users
    .map((reviewer) => {
      const stats = buildReviewerStats(reviewer, period);
      return {
        reviewerId: reviewer.id,
        name: reviewer.name,
        email: reviewer.email,
        activeAssignments: stats.activeAssignments,
        completedAssignments: stats.completedAssignments,
        overdueAssignments: stats.overdueAssignments,
      };
    })
    .sort((a, b) => b.activeAssignments - a.activeAssignments);
}

export function getReviewerLeaderboard(period: AnalyticsPeriod = "overall") {
  const users = listUsers().filter((user) => user.role === "MEMBER");
  return users
    .map((reviewer) => buildReviewerStats(reviewer, period))
    .sort((a, b) => {
      if (b.averageOverallRating !== a.averageOverallRating) {
        return b.averageOverallRating - a.averageOverallRating;
      }
      if (b.completedAssignments !== a.completedAssignments) {
        return b.completedAssignments - a.completedAssignments;
      }
      return b.onTimeRate - a.onTimeRate;
    });
}

export function getReviewerAnalytics(reviewerId: string, period: AnalyticsPeriod = "overall") {
  const reviewer = listUsers().find((user) => user.id === reviewerId);
  if (!reviewer) {
    return null;
  }

  const stats = buildReviewerStats(reviewer, period);
  const periodStart = getDateRangeStart(period);
  const assignments = listAssignmentsForReviewer(reviewerId).filter(
    (entry) => isWithinPeriod(entry.assignment.assignedAt, periodStart)
  );
  const ratings = getRatingsForReviewer(reviewerId).filter((rating) =>
    isWithinPeriod(rating.createdAt, periodStart)
  );

  return {
    stats,
    assignments,
    ratings,
  };
}

function storeComplianceChecks(checks: ComplianceCheckRecord[]) {
  const existing = readCollection("complianceChecks");
  writeCollection("complianceChecks", [...existing, ...checks]);
}

function getPaperTextForCompliance(paper: PaperRecord, extractedText?: string) {
  return `${paper.title}\n${paper.abstractText ?? ""}\n${extractedText ?? ""}`.toLowerCase();
}

// Section name synonym groups. A required section "Method" matches an extracted
// section "Methodology" or "Approach"; "Experiments" matches "Evaluation" / "Results";
// etc. Real papers vary in their heading conventions and we don't want compliance to
// fail on cosmetic mismatches.
const SECTION_SYNONYMS: Record<string, string[]> = {
  abstract: ["abstract"],
  introduction: ["introduction", "motivation", "problem statement"],
  "related work": ["related work", "background", "prior work", "literature review", "related literature"],
  background: ["background", "related work", "preliminaries"],
  method: ["method", "methodology", "approach", "technique", "methods", "our approach"],
  methodology: ["methodology", "method", "approach", "technique", "methods"],
  approach: ["approach", "method", "methodology", "technique", "our approach"],
  experiments: ["experiments", "evaluation", "results", "empirical study", "experimental results", "experimental setup", "findings"],
  evaluation: ["evaluation", "experiments", "results", "empirical evaluation", "findings"],
  results: ["results", "evaluation", "experiments", "findings", "outcomes"],
  findings: ["findings", "results", "evaluation", "outcomes"],
  conclusion: ["conclusion", "conclusions", "concluding remarks", "discussion and conclusion", "summary"],
  "threats to validity": ["threats to validity", "limitations", "validity threats", "threats", "limitations and threats"],
  implementation: ["implementation", "system design", "architecture", "system architecture"],
  design: ["design", "system design", "architecture"],
  data: ["data", "dataset", "datasets", "data collection"],
  availability: ["availability", "artifact availability", "artifact", "replication package", "reproducibility"],
  discussion: ["discussion", "analysis"],
};

function expandSynonyms(needle: string): string[] {
  const norm = needle.toLowerCase().trim();
  const direct = SECTION_SYNONYMS[norm];
  if (direct) return direct;
  for (const synonyms of Object.values(SECTION_SYNONYMS)) {
    if (synonyms.includes(norm)) return synonyms;
  }
  return [norm];
}

async function readTextSidecar(pdfPath: string | null | undefined): Promise<string | null> {
  if (!pdfPath) return null;
  try {
    const fs = await import("fs/promises");
    const path = await import("path");
    const uploadsDir = path.resolve(process.cwd(), "data", "uploads");
    const resolved = path.resolve(process.cwd(), pdfPath);
    if (!resolved.startsWith(uploadsDir + path.sep) && resolved !== uploadsDir) {
      return null;
    }
    const txtPath = resolved.replace(/\.pdf$/i, ".txt");
    return await fs.readFile(txtPath, "utf8");
  } catch {
    return null;
  }
}

export async function runComplianceChecks(input: ComplianceInput) {
  const paper = getPaperById(input.paperId);
  if (!paper) {
    throw new Error("Paper not found");
  }

  if (!paper.venueId) {
    throw new Error("Paper has no venue selected");
  }

  const venue = getVenueById(paper.venueId);
  if (!venue) {
    throw new Error("Venue not found");
  }

  const abstractWordCount = (paper.abstractText ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
  const sidecarText = input.extractedText ? null : await readTextSidecar(paper.pdfPath);
  const effectiveExtractedText = input.extractedText ?? sidecarText ?? "";
  const text = getPaperTextForCompliance(paper, effectiveExtractedText);
  const effectiveSections = input.extractedSections ?? paper.extractedSections ?? null;
  const effectiveReferences = input.extractedReferences ?? paper.extractedReferences ?? null;
  const pageCount = input.pageCount ?? paper.pageCount ?? null;
  const metadataAuthor = input.metadata?.author?.trim() || "";
  const metadataCompany = input.metadata?.company?.trim() || "";

  console.log(
    "[compliance] paper", paper.id,
    "venue:", venue.name,
    "pageCount:", pageCount,
    "sections-source:", effectiveSections ? "structured" : "text-heuristic",
    "refs-source:", effectiveReferences ? "structured" : "text-heuristic",
  );

  const checks: Array<{
    checkType: ComplianceCheckType;
    passed: boolean;
    details: Record<string, unknown>;
  }> = [];

  // Page-limit math respects the venue's reference-counting policy. When
  // `referencesCountTowardLimit === false`, references are excluded from the
  // body page count and `extraRefPages` reference pages are allowed on top.
  // Estimate references pages from `extractedReferences` (≈25 refs/page,
  // conservative for two-column ACM/IEEE).
  const refsCountToward = venue.referencesCountTowardLimit ?? null;
  const extraRefPages = venue.extraRefPages ?? null;
  const refsExcluded = refsCountToward === false;
  const refCountForEstimate = effectiveReferences?.length ?? 0;
  const estimatedRefPages =
    refsExcluded && refCountForEstimate > 0
      ? Math.max(1, Math.ceil(refCountForEstimate / 25))
      : 0;
  const effectivePageCount =
    pageCount !== null && refsExcluded
      ? Math.max(0, Number(pageCount) - estimatedRefPages)
      : pageCount;
  const effectiveLimit =
    venue.pageLimit !== null && refsExcluded && extraRefPages !== null
      ? Number(venue.pageLimit) + Number(extraRefPages)
      : venue.pageLimit;
  const pageLimitPassed =
    venue.pageLimit === null ||
    pageCount === null ||
    (refsExcluded
      ? Number(effectivePageCount) <= Number(venue.pageLimit) ||
        Number(pageCount) <= Number(effectiveLimit)
      : Number(pageCount) <= Number(venue.pageLimit));
  const limitDescription =
    venue.pageLimit !== null && refsExcluded && extraRefPages !== null
      ? `${venue.pageLimit} + ${extraRefPages} reference pages (${effectiveLimit} total)`
      : venue.pageLimit !== null && refsExcluded
        ? `${venue.pageLimit} pages (references don't count)`
        : venue.pageLimit !== null
          ? `${venue.pageLimit} pages`
          : "unspecified";
  const pageLimitMessage =
    pageCount === null
      ? `Page count was not extracted from the PDF; ${venue.name}'s ${limitDescription} limit could not be checked. Re-upload the PDF.`
      : venue.pageLimit === null
        ? `${venue.name} does not specify a page limit. Paper is ${pageCount} ${pageCount === 1 ? "page" : "pages"}.`
        : pageLimitPassed
          ? refsExcluded && extraRefPages !== null
            ? `Paper is ${pageCount} pages (≈${estimatedRefPages} reference page${estimatedRefPages === 1 ? "" : "s"} excluded), within ${venue.name}'s ${limitDescription} limit.`
            : `Paper is ${pageCount} ${pageCount === 1 ? "page" : "pages"}, within ${venue.name}'s ${limitDescription} limit.`
          : `Paper is ${pageCount} pages. ${venue.name} limit is ${limitDescription}. Remove ${Math.max(0, Number(pageCount) - Number(effectiveLimit ?? venue.pageLimit))} page${Math.max(0, Number(pageCount) - Number(effectiveLimit ?? venue.pageLimit)) === 1 ? "" : "s"} of content (or move material to appendix if the venue allows).`;
  checks.push({
    checkType: "PAGE_LIMIT",
    passed: pageLimitPassed,
    details: {
      message: pageLimitMessage,
      pageCount,
      pageLimit: venue.pageLimit,
      effectiveLimit,
      referencesCountTowardLimit: refsCountToward,
      extraRefPages,
      estimatedReferencePages: refsExcluded ? estimatedRefPages : null,
      note:
        pageCount === null ? "Page count not provided; check skipped." : undefined,
    },
  });

  const abstractPassed =
    venue.abstractWordLimit === null || abstractWordCount <= venue.abstractWordLimit;
  const abstractMessage =
    venue.abstractWordLimit === null
      ? `${venue.name} does not specify an abstract word limit. Abstract is ${abstractWordCount} words.`
      : abstractPassed
        ? `Abstract is ${abstractWordCount} words, within the ${venue.abstractWordLimit}-word limit.`
        : `Abstract is ${abstractWordCount} words; ${venue.name} allows ${venue.abstractWordLimit}. Trim by ${abstractWordCount - venue.abstractWordLimit} word${abstractWordCount - venue.abstractWordLimit === 1 ? "" : "s"}.`;
  checks.push({
    checkType: "ABSTRACT_WORD_COUNT",
    passed: abstractPassed,
    details: {
      message: abstractMessage,
      abstractWordCount,
      abstractWordLimit: venue.abstractWordLimit,
    },
  });

  const { getValidationProfile, findIdentityRevealingLinks } = await import(
    "@/lib/validation-profiles"
  );
  const profile = getValidationProfile(paper.paperType, venue.track);
  const profileExtraSections = profile?.extraRequiredSections ?? [];
  // Three tiers of section requirements:
  //   - Mandatory: venue.requiredSections + profile extras + special sections
  //     where deskRejectIfMissing !== false. Missing → check fails.
  //   - Special non-fatal: special sections with deskRejectIfMissing === false.
  //     Missing → warning, doesn't fail the check.
  //   - Conventional: venue.conventionalSections. Missing → warning only.
  const specialSections = venue.specialRequiredSections ?? [];
  const mandatorySpecialSectionNames = specialSections
    .filter((s) => s.deskRejectIfMissing !== false)
    .map((s) => s.name);
  const softSpecialSectionNames = specialSections
    .filter((s) => s.deskRejectIfMissing === false)
    .map((s) => s.name);
  const conventionalSectionNames = venue.conventionalSections ?? [];
  const combinedRequiredSections = Array.from(
    new Set([
      ...venue.requiredSections,
      ...profileExtraSections,
      ...mandatorySpecialSectionNames,
    ]),
  );
  const softSectionsAll = Array.from(
    new Set([...softSpecialSectionNames, ...conventionalSectionNames]),
  );
  const normalizedSectionList = effectiveSections?.map((s) => s.toLowerCase().trim()) ?? null;
  const sectionMatchInfo = (needle: string): { matched: boolean; matchedAs?: string } => {
    const expansions = expandSynonyms(needle);
    for (const exp of expansions) {
      if (normalizedSectionList) {
        const hit = normalizedSectionList.find((s) => s === exp || s.includes(exp) || exp.includes(s));
        if (hit) return { matched: true, matchedAs: hit };
      } else if (text.includes(exp)) {
        return { matched: true, matchedAs: exp };
      }
    }
    return { matched: false };
  };
  const sectionMatch = (needle: string) => sectionMatchInfo(needle).matched;
  const sectionMatches: Record<string, string | null> = {};
  const missingSections: string[] = [];
  for (const section of combinedRequiredSections) {
    const info = sectionMatchInfo(section);
    if (info.matched) {
      sectionMatches[section] = info.matchedAs ?? null;
    } else {
      missingSections.push(section);
    }
  }
  const missingSoftSections: string[] = [];
  for (const section of softSectionsAll) {
    if (!sectionMatch(section)) missingSoftSections.push(section);
  }
  const sectionsPassed = missingSections.length === 0;
  const warningSuffix =
    missingSoftSections.length > 0
      ? ` Suggested but not enforced: ${missingSoftSections.join(", ")}.`
      : "";
  const requiredSectionsMessage = sectionsPassed
    ? `All ${combinedRequiredSections.length} required sections present (${combinedRequiredSections.join(", ")})${normalizedSectionList ? " — matched against the structured section list extracted from the PDF" : " — matched against full paper text"}.${warningSuffix}`
    : `Missing section${missingSections.length === 1 ? "" : "s"}: ${missingSections.join(", ")}. ${venue.name} expects ${missingSections.length === 1 ? "this section" : "these sections"}. Add ${missingSections.length === 1 ? `a "${missingSections[0]}" section` : "the missing sections"} to the paper${normalizedSectionList ? ` (the PDF currently has: ${effectiveSections?.join(", ") ?? "—"})` : ""}.${warningSuffix}`;
  checks.push({
    checkType: "REQUIRED_SECTIONS",
    passed: sectionsPassed,
    details: {
      message: requiredSectionsMessage,
      requiredSections: combinedRequiredSections,
      missingSections,
      venueRequiredSections: venue.requiredSections,
      profileRequiredSections: profileExtraSections,
      specialRequiredSections: specialSections,
      conventionalSections: conventionalSectionNames,
      warnings: missingSoftSections,
      source: normalizedSectionList ? "structured-extraction" : "text-heuristic",
      extractedSections: effectiveSections ?? undefined,
      matchedAs: sectionMatches,
    },
  });

  if (profile && profile.checklistKeywords.length > 0) {
    const checklistResults = profile.checklistKeywords.map((item) => ({
      phrase: item.phrase,
      description: item.description,
      present: sectionMatch(item.phrase) || text.includes(item.phrase.toLowerCase()),
    }));
    const missingChecklist = checklistResults.filter((c) => !c.present);
    const checklistPassed = missingChecklist.length === 0;
    const paperTypeLabel = (paper.paperType ?? "this paper type").toString().toLowerCase().replace("_", " ");
    const checklistMessage = checklistPassed
      ? `All ${paperTypeLabel} checklist items present.`
      : `Missing typical ${paperTypeLabel} content: ${missingChecklist.map((c) => c.description).join(", ")}. Reviewers will look for this — adding it strengthens the paper.`;
    checks.push({
      checkType: "DYNAMIC_CHECKLIST",
      passed: checklistPassed,
      details: {
        message: checklistMessage,
        paperType: paper.paperType,
        track: venue.track,
        items: checklistResults,
        missing: missingChecklist.map((c) => c.description),
      },
    });
  }

  const metadataPass =
    !venue.anonymityRequired ||
    (metadataAuthor.length === 0 && metadataCompany.length === 0);
  const metadataMessage = !venue.anonymityRequired
    ? `${venue.name} does not require anonymity; PDF metadata fields are informational only.`
    : metadataPass
      ? "PDF metadata fields supplied via the compliance request are clear of identifying info."
      : `PDF metadata exposes identifying info: ${[
          metadataAuthor && `Author='${metadataAuthor}'`,
          metadataCompany && `Company='${metadataCompany}'`,
        ].filter(Boolean).join(", ")}. Clear metadata before submission: in LaTeX add \\pdfinfo{ /Author () }, or run 'exiftool -Author= -Company= file.pdf' on the produced PDF.`;
  checks.push({
    checkType: "METADATA_CHECK",
    passed: metadataPass,
    details: {
      message: metadataMessage,
      anonymityRequired: venue.anonymityRequired,
      metadataAuthor,
      metadataCompany,
    },
  });

  const anonymityKeywords = [
    "bilkent",
    "our university",
    "our department",
    "our institution",
    "our previous work",
    "we previously",
    "our earlier",
    "in our work",
    "our approach in",
    "my thesis",
    "my dissertation",
    "our lab",
    "our group",
    "our team",
    "our company",
  ];
  const keywordFlags = anonymityKeywords.filter((kw) => text.includes(kw));

  const anonymityPatterns: Array<{ label: string; pattern: RegExp }> = [
    { label: "GitHub URL", pattern: /github\.com\/[a-zA-Z0-9_-]+/ },
    { label: "LinkedIn profile", pattern: /linkedin\.com\/in\/[a-zA-Z0-9_-]+/ },
    { label: "Institutional URL", pattern: /https?:\/\/[^\s]*\.(edu|ac\.[a-z]{2})\b/ },
    { label: "Email address", pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/ },
  ];
  const patternFlags = anonymityPatterns
    .filter((p) => p.pattern.test(text))
    .map((p) => p.label);

  const allFlags = [...keywordFlags, ...patternFlags];
  const anonymityPassed = !venue.anonymityRequired || allFlags.length === 0;
  const anonymityMessage = !venue.anonymityRequired
    ? `${venue.name} does not require anonymity; identifying mentions are informational only.${allFlags.length > 0 ? ` Detected: ${allFlags.join(", ")}.` : ""}`
    : anonymityPassed
      ? "No identifying author or institution mentions detected in the manuscript text."
      : `Found ${allFlags.length} identifying mention${allFlags.length === 1 ? "" : "s"}: ${allFlags.join(", ")}. Replace with anonymous placeholders ('Anonymous University', '[redacted]') before double-blind submission.`;
  checks.push({
    checkType: "ANONYMITY_CHECK",
    passed: anonymityPassed,
    details: {
      message: anonymityMessage,
      anonymityRequired: venue.anonymityRequired,
      keywordFlags,
      patternFlags,
      flags: allFlags,
    },
  });

  if (venue.anonymityRequired || profile) {
    const sourceForLinks = `${effectiveExtractedText}\n${paper.abstractText ?? ""}`;
    const suspectLinks = findIdentityRevealingLinks(sourceForLinks);
    const linksPassed = !venue.anonymityRequired || suspectLinks.length === 0;
    const linksMessage = !venue.anonymityRequired
      ? `${venue.name} does not require anonymity; tool/dataset links are informational only.${suspectLinks.length > 0 ? ` Detected ${suspectLinks.length} link(s).` : ""}`
      : linksPassed
        ? "No identity-revealing tool/dataset links detected."
        : `Found ${suspectLinks.length} identity-revealing link${suspectLinks.length === 1 ? "" : "s"}: ${suspectLinks.slice(0, 3).map((l) => l.url).join(", ")}${suspectLinks.length > 3 ? ", …" : ""}. Use anonymous.4open.science (or strip the link until camera-ready).`;
    checks.push({
      checkType: "TOOL_LINK_ANONYMITY",
      passed: linksPassed,
      details: {
        message: linksMessage,
        anonymityRequired: venue.anonymityRequired,
        suspectLinks,
        note:
          suspectLinks.length === 0
            ? "No identity-revealing tool/dataset links detected."
            : `${suspectLinks.length} suspect link(s) detected.`,
      },
    });
  }

  // Reference format check
  if (venue.referenceFormat) {
    const referencesText = effectiveReferences?.length
      ? effectiveReferences.join("\n")
      : effectiveExtractedText;
    const hasReferenceData = Boolean(referencesText.trim());

    if (!hasReferenceData) {
      checks.push({
        checkType: "REFERENCE_FORMAT",
        passed: true,
        details: {
          message: `Reference data not available — could not verify ${venue.referenceFormat} citation format. Re-upload the PDF if you want this check to run.`,
          expectedFormat: venue.referenceFormat,
          note: "Reference data not available; check skipped.",
          source: "none",
        },
      });
    } else {
      const lowerRefText = referencesText.toLowerCase();
      const hasReferencesSection =
        Boolean(effectiveReferences?.length) ||
        /\b(references|bibliography)\b/.test(lowerRefText);
      let formatMatched = false;
      let detectedHint = "unknown";

      const authorYearRegex = /\([A-Z][a-z]+(?:\s+et\s+al\.?)?,?\s*\d{4}\)/;
      const numberedRegex = /\[\d+(?:\s*,\s*\d+)*\]/;
      const format = venue.referenceFormat.toUpperCase();
      const detailType = venue.referenceFormatDetails?.type ?? null;
      if (detailType === "either") {
        const authorYear = authorYearRegex.test(referencesText);
        const numbered = numberedRegex.test(referencesText);
        formatMatched = authorYear || numbered;
        detectedHint = formatMatched
          ? `${authorYear ? "author-year" : ""}${authorYear && numbered ? " and " : ""}${numbered ? "numbered" : ""} citations found (either accepted)`
          : "no citations matching either author-year or numbered styles found";
      } else if (detailType === "numbered" || (detailType === null && format === "IEEE")) {
        formatMatched = numberedRegex.test(referencesText);
        detectedHint = formatMatched ? "numbered citations found" : "no numbered citations found";
      } else if (detailType === "author-year" || (detailType === null && format === "ACM")) {
        formatMatched = authorYearRegex.test(referencesText);
        detectedHint = formatMatched ? "author-year citations found" : "no author-year citations found";
      } else {
        formatMatched = hasReferencesSection;
        detectedHint = hasReferencesSection ? "references section present" : "no references section found";
      }

      const refsPassed = hasReferencesSection && formatMatched;
      const refsMessage = refsPassed
        ? `References use ${venue.referenceFormat} format as expected by ${venue.name} (${detectedHint}).`
        : !hasReferencesSection
          ? `No references section detected. ${venue.name} requires a References / Bibliography section in ${venue.referenceFormat} format.`
          : `Expected ${venue.referenceFormat} format but ${detectedHint}. ${
              format === "ACM"
                ? "Use \\citep{} (natbib) so citations render as '(Smith et al., 2024)'."
                : format === "IEEE"
                  ? "Use IEEEtran or \\bibliographystyle{IEEEtran} so citations render as '[1]'."
                  : "Update the bibliography style accordingly."
            }`;

      checks.push({
        checkType: "REFERENCE_FORMAT",
        passed: refsPassed,
        details: {
          message: refsMessage,
          expectedFormat: venue.referenceFormat,
          hasReferencesSection,
          detectedHint,
          source: effectiveReferences?.length ? "structured-extraction" : "text-heuristic",
        },
      });
    }
  }

  let pdfBuffer: Uint8Array | ArrayBuffer | null = input.pdfBuffer ?? null;
  if (!pdfBuffer) {
    const { loadPdfBuffer } = await import("@/lib/pdf-metadata");
    pdfBuffer = await loadPdfBuffer(paper);
  }

  if (pdfBuffer) {
    try {
      const { readPdfMetadata, metadataSuggestsIdentity } = await import(
        "@/lib/pdf-metadata"
      );
      const pdfMeta = await readPdfMetadata(pdfBuffer);
      const { hasIdentity, flags } = metadataSuggestsIdentity(pdfMeta);
      const shouldFail = venue.anonymityRequired && hasIdentity;
      const pdfMetaMessage = !venue.anonymityRequired
        ? `${venue.name} does not require anonymity; embedded PDF metadata is informational only.${flags.length > 0 ? ` Detected: ${flags.join("; ")}.` : ""}`
        : shouldFail
          ? `PDF embedded metadata reveals identity: ${flags.join("; ")}. Clear metadata before re-uploading: in LaTeX add \\pdfinfo{ /Author () /Title () }, or run 'exiftool -Author= -Title= -Subject= -Creator= file.pdf' on the produced PDF.`
          : "PDF embedded metadata does not reveal author identity.";
      checks.push({
        checkType: "PDF_METADATA_ANONYMITY",
        passed: !shouldFail,
        details: {
          message: pdfMetaMessage,
          anonymityRequired: venue.anonymityRequired,
          author: pdfMeta.author,
          creator: pdfMeta.creator,
          producer: pdfMeta.producer,
          flags,
          note: venue.anonymityRequired
            ? undefined
            : "Venue does not require anonymity; check informational only.",
        },
      });
    } catch {
      // PDF could not be parsed; skip silently.
    }
  }

  // DESK_REJECT_RISK: consolidate venue.deskRejectCriteria into a single
  // checklist. For criteria that map to existing checks (page limit,
  // anonymity-related), surface their pass/fail. Others are flagged manual.
  const criteria = venue.deskRejectCriteria ?? [];
  if (criteria.length > 0) {
    const checkMap = new Map<ComplianceCheckType, boolean>();
    for (const c of checks) checkMap.set(c.checkType, c.passed);
    const passed = (t: ComplianceCheckType) => checkMap.get(t) !== false;

    type DeskItem = {
      criterion: string;
      kind: "auto" | "manual";
      status: "pass" | "fail" | "manual";
      relatedCheck?: ComplianceCheckType;
      note?: string;
    };
    const items: DeskItem[] = criteria.map((criterion) => {
      const lc = criterion.toLowerCase();
      if (lc.includes("page limit") || lc.includes("page-limit") || lc.includes("page count") || lc.includes("non-compliant page")) {
        return {
          criterion,
          kind: "auto",
          status: passed("PAGE_LIMIT") ? "pass" : "fail",
          relatedCheck: "PAGE_LIMIT",
        };
      }
      if (lc.includes("non-anonymous") || lc.includes("anonymous") || lc.includes("blind")) {
        const anonymityPasses =
          passed("ANONYMITY_CHECK") &&
          passed("METADATA_CHECK") &&
          passed("PDF_METADATA_ANONYMITY") &&
          passed("TOOL_LINK_ANONYMITY");
        return {
          criterion,
          kind: "auto",
          status: anonymityPasses ? "pass" : "fail",
          relatedCheck: "ANONYMITY_CHECK",
        };
      }
      if (lc.includes("template") || lc.includes("margin") || lc.includes("font")) {
        return {
          criterion,
          kind: "manual",
          status: "manual",
          note: "Confirm you used the venue's official template (sigconf for ACM, IEEEtran for IEEE) without modified margins or fonts.",
        };
      }
      if (lc.includes("dual submission") || lc.includes("concurrent") || lc.includes("plagiarism")) {
        return {
          criterion,
          kind: "manual",
          status: "manual",
          note: "Confirm this paper is not under review elsewhere; ACM/IEEE plagiarism policy applies.",
        };
      }
      if (lc.includes("scope") || lc.includes("out of scope")) {
        return {
          criterion,
          kind: "manual",
          status: "manual",
          note: "Confirm the paper falls within the venue's stated scope.",
        };
      }
      return {
        criterion,
        kind: "manual",
        status: "manual",
        note: "Manual confirmation required.",
      };
    });

    const autoFailures = items.filter((i) => i.kind === "auto" && i.status === "fail");
    const desk_passed = autoFailures.length === 0;
    const message = desk_passed
      ? `No automated desk-reject signals detected. Manually confirm the ${items.filter((i) => i.kind === "manual").length} item${items.filter((i) => i.kind === "manual").length === 1 ? "" : "s"} below before submitting to ${venue.name}.`
      : `Automated desk-reject risk: ${autoFailures.map((i) => i.criterion).join("; ")}. Resolve before submitting.`;
    checks.push({
      checkType: "DESK_REJECT_RISK",
      passed: desk_passed,
      details: { message, items },
    });
  }

  const timestamp = nowIso();
  const records: ComplianceCheckRecord[] = checks.map((check) => ({
    id: crypto.randomUUID(),
    paperId: paper.id,
    checkType: check.checkType,
    passed: check.passed,
    details: check.details,
    checkedAt: timestamp,
  }));

  storeComplianceChecks(records);

  const failures = records.filter((record) => !record.passed).length;
  for (const authorId of paper.authorIds) {
    createNotification({
      userId: authorId,
      type: "COMPLIANCE_RESULT",
      title: failures === 0 ? "Compliance passed" : "Compliance issues found",
      message:
        failures === 0
          ? `All compliance checks passed for "${paper.title}".`
          : `${failures} compliance check(s) failed for "${paper.title}".`,
      link: `/papers/${paper.id}`,
      sentViaEmail: failures > 0,
      sentViaSlack: true,
    });
  }

  return records;
}

export function getComplianceChecksByPaper(paperId: string) {
  return readCollection("complianceChecks")
    .filter((check) => check.paperId === paperId)
    .sort((a, b) => b.checkedAt.localeCompare(a.checkedAt));
}

// Run both AI agents (paper compliance + reference verification) in parallel
// against a paper that has been uploaded with a venue selected. Stores the
// results as two new ComplianceCheckRecord rows so they show up alongside the
// heuristic checks on the paper detail page.
export async function runAiComplianceAndReferences(paperId: string): Promise<{
  aiCompliance: ComplianceCheckRecord;
  aiReferences: ComplianceCheckRecord;
}> {
  const paper = getPaperById(paperId);
  if (!paper) {
    throw new Error("Paper not found");
  }
  if (!paper.venueId) {
    throw new Error("Paper has no venue selected — pick a venue before running AI compliance.");
  }
  const venue = getVenueById(paper.venueId);
  if (!venue) {
    throw new Error("Venue not found");
  }

  const sidecarText = await readTextSidecar(paper.pdfPath);
  const paperText = sidecarText ?? "";
  if (!paperText.trim()) {
    throw new Error(
      "No extracted text available for this paper. Re-upload the PDF so the AI can read it.",
    );
  }

  const { runAiPaperCompliance, runReferenceVerification } = await import(
    "@/lib/ai-compliance"
  );

  // Two agents in parallel — Promise.all so they share the wall clock.
  const [aiCompliance, aiReferences] = await Promise.all([
    runAiPaperCompliance({
      paper,
      venue,
      paperText,
      pageCount: paper.pageCount ?? null,
      extractedSections: paper.extractedSections ?? null,
      extractedReferences: paper.extractedReferences ?? null,
    }),
    runReferenceVerification({
      paperTitle: paper.title,
      paperAbstract: paper.abstractText,
      paperDomain: venue.domain ?? null,
      references: paper.extractedReferences ?? [],
      paperText,
    }),
  ]);

  const checkedAt = nowIso();

  const compliancePassed =
    aiCompliance.passed && !aiCompliance.error;
  const referencesPassed =
    aiReferences.summary.suspicious === 0 &&
    aiReferences.summary.malformed === 0 &&
    !aiReferences.error;

  const aiComplianceRecord: ComplianceCheckRecord = {
    id: crypto.randomUUID(),
    paperId: paper.id,
    checkType: "AI_FULL_REVIEW",
    passed: compliancePassed,
    details: {
      message:
        aiCompliance.error
          ? `AI compliance check failed: ${aiCompliance.error}`
          : aiCompliance.overallSummary ||
            `AI compliance ${compliancePassed ? "passed" : "found issues"} for ${venue.name}.`,
      checks: aiCompliance.checks,
      deskRejectRisk: aiCompliance.deskRejectRisk,
      failedDimensions: aiCompliance.failedDimensions,
      warningDimensions: aiCompliance.warningDimensions,
      modelUsed: aiCompliance.modelUsed,
      paperTruncated: aiCompliance.paperTruncated,
      generatedAt: aiCompliance.generatedAt,
      error: aiCompliance.error,
    },
    checkedAt,
  };

  const aiReferenceRecord: ComplianceCheckRecord = {
    id: crypto.randomUUID(),
    paperId: paper.id,
    checkType: "AI_REFERENCE_CHECK",
    passed: referencesPassed,
    details: {
      message:
        aiReferences.error === "no-references"
          ? "No references could be extracted for verification. Re-upload the PDF if you want this check to run."
          : aiReferences.error
            ? `AI reference verification encountered errors: ${aiReferences.error}`
            : aiReferences.summary.overallAssessment,
      summary: aiReferences.summary,
      references: aiReferences.references,
      modelUsed: aiReferences.modelUsed,
      generatedAt: aiReferences.generatedAt,
      error: aiReferences.error,
    },
    checkedAt,
  };

  storeComplianceChecks([aiComplianceRecord, aiReferenceRecord]);

  // Notify authors that AI review is ready (single notification covering both).
  const failures = (compliancePassed ? 0 : 1) + (referencesPassed ? 0 : 1);
  for (const authorId of paper.authorIds) {
    createNotification({
      userId: authorId,
      type: "COMPLIANCE_RESULT",
      title: failures === 0 ? "AI review passed" : "AI review found issues",
      message:
        failures === 0
          ? `AI compliance + reference verification passed for "${paper.title}".`
          : `AI review flagged ${failures} area${failures === 1 ? "" : "s"} for "${paper.title}".`,
      link: `/papers/${paper.id}`,
      sentViaEmail: failures > 0,
      sentViaSlack: false,
    });
  }

  // When the paper is clearly assignable, pre-create an empty review round
  // and nudge coordinators so reviewer assignment doesn't sit waiting for
  // someone to notice the new submission.
  const readyForAssignment =
    compliancePassed &&
    referencesPassed &&
    aiCompliance.deskRejectRisk !== "high";

  if (readyForAssignment) {
    const existingRounds = listRoundsForPaper(paper.id);
    if (existingRounds.length === 0) {
      createReviewRound(paper.id);
    }

    for (const coordinator of getCoordinators()) {
      createNotification({
        userId: coordinator.id,
        type: "COMPLIANCE_RESULT",
        title: "Paper ready for reviewer assignment",
        message: `"${paper.title}" passed AI compliance. Assign reviewers to start the review round.`,
        link: `/admin/papers/${paper.id}/assign`,
        sentViaEmail: true,
        sentViaSlack: false,
      });
    }
  }

  return { aiCompliance: aiComplianceRecord, aiReferences: aiReferenceRecord };
}

export async function generateAiReviewDraft(extractedText: string) {
  if (!extractedText.trim()) {
    throw new Error("Paper text is required");
  }

  if (process.env.ANTHROPIC_API_KEY) {
    const { generateReviewWithClaude } = await import("@/lib/ai");
    const review = await generateReviewWithClaude(extractedText);
    return {
      ...review,
      estimatedWordCount: extractedText.split(/\s+/).filter(Boolean).length,
    };
  }

  const wordCount = extractedText
    .split(/\s+/)
    .map((word) => word.trim())
    .filter(Boolean).length;

  return {
    summary:
      "This is a local deterministic draft. Plug in Anthropic API later for production quality.",
    strengths: [
      { point: "Problem framing appears clear and scoped.", quote: "", unsupported: false },
      { point: "The draft contains a concrete method section.", quote: "", unsupported: false },
      { point: "The paper structure is generally coherent.", quote: "", unsupported: false },
    ],
    concerns: [
      { point: "Add stronger empirical evaluation details.", quote: "", unsupported: false },
      { point: "Clarify threat model and limitations.", quote: "", unsupported: false },
      { point: "Improve related work positioning.", quote: "", unsupported: false },
    ],
    recommendation: "MINOR_REVISION",
    unsupportedCount: 0,
    estimatedWordCount: wordCount,
  };
}

export function getLatestAiReportForPaper(paperId: string) {
  const all = readCollection("aiReports").filter((r) => r.paperId === paperId);
  return all.sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null;
}

export async function generateAndStoreFinalReport(paperId: string) {
  const paper = getPaperById(paperId);
  if (!paper) {
    throw new Error("Paper not found");
  }

  const details = getPaperDetails(paperId);
  if (!details) {
    throw new Error("Paper details unavailable");
  }

  const reviews: Array<{
    review: ReviewRecord;
    reviewerName: string;
  }> = [];

  for (const round of details.rounds) {
    for (const review of round.reviews) {
      const assignment = round.assignments.find((a) => a.id === review.assignmentId);
      if (!assignment) continue;
      const reviewer = getUserById(assignment.reviewerId);
      reviews.push({
        review,
        reviewerName: reviewer?.name ?? "Reviewer",
      });
    }
  }

  if (reviews.length === 0) {
    throw new Error("No completed reviews to synthesize");
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not configured");
  }

  const { generateFinalReportWithClaude } = await import("@/lib/ai");
  const synth = await generateFinalReportWithClaude({
    paperTitle: paper.title,
    abstractText: paper.abstractText,
    reviews: reviews.map((r) => ({
      reviewerName: r.reviewerName,
      comments: r.review.comments,
      recommendation: r.review.recommendation,
      overallScore: r.review.overallScore,
    })),
  });

  const record = {
    id: crypto.randomUUID(),
    paperId,
    reviewIds: reviews.map((r) => r.review.id),
    consensusSummary: synth.consensusSummary,
    agreedStrengths: synth.agreedStrengths,
    agreedConcerns: synth.agreedConcerns,
    divergences: synth.divergences,
    overallRecommendation: synth.overallRecommendation,
    reviewerCount: reviews.length,
    createdAt: nowIso(),
  };

  upsertCollection("aiReports", (existing) => [...existing, record]);
  return record;
}

export async function generateAiSuggestions(extractedText: string) {
  if (!extractedText.trim()) {
    throw new Error("Paper text is required");
  }

  if (process.env.ANTHROPIC_API_KEY) {
    const { generateSuggestionsWithClaude } = await import("@/lib/ai");
    return generateSuggestionsWithClaude(extractedText);
  }

  const lower = extractedText.toLowerCase();
  const suggestions: string[] = [];

  if (!lower.includes("threat") && !lower.includes("limitation")) {
    suggestions.push("Add a dedicated limitations/threats-to-validity section.");
  }
  if (!lower.includes("dataset")) {
    suggestions.push("Clarify dataset construction and preprocessing details.");
  }
  if (!lower.includes("baseline")) {
    suggestions.push("Compare against stronger baselines in evaluation.");
  }
  if (suggestions.length === 0) {
    suggestions.push(
      "The draft is generally solid; focus on tightening claims with more evidence."
    );
  }

  return suggestions;
}

export async function getVenueRecommendations(paperId: string, limit = 5) {
  const paper = getPaperById(paperId);
  if (!paper) {
    throw new Error("Paper not found");
  }
  const { recommendVenues } = await import("@/lib/venue-recommender");
  const venues = listVenues();
  return recommendVenues(paper, venues, limit);
}

export interface SubmitVenueResult {
  paper: PaperRecord;
  failedChecks: ComplianceCheckRecord[];
}

export async function submitPaperToVenue(paperId: string, venueId: string): Promise<SubmitVenueResult> {
  const paper = getPaperById(paperId);
  if (!paper) {
    throw new Error("Paper not found");
  }
  const venue = getVenueById(venueId);
  if (!venue) {
    throw new Error("Venue not found");
  }

  if (paper.status === "SUBMITTED_TO_VENUE") {
    throw new Error("Paper has already been submitted to a venue");
  }

  // Compliance must have been run against THIS venue (paper.venueId === venueId)
  // and every check must pass.
  if (paper.venueId !== venueId) {
    throw new Error(
      "Paper's selected venue does not match submission target. Run compliance for the target venue first.",
    );
  }

  const checks = getComplianceChecksByPaper(paperId);
  if (checks.length === 0) {
    throw new Error("No compliance checks have been run. Run compliance first.");
  }

  const latestByType = new Map<ComplianceCheckType, ComplianceCheckRecord>();
  for (const check of checks) {
    const existing = latestByType.get(check.checkType);
    if (!existing || check.checkedAt > existing.checkedAt) {
      latestByType.set(check.checkType, check);
    }
  }
  const failedChecks = Array.from(latestByType.values()).filter((c) => !c.passed);
  if (failedChecks.length > 0) {
    return { paper, failedChecks };
  }

  const timestamp = nowIso();
  const updated: PaperRecord = {
    ...paper,
    status: "SUBMITTED_TO_VENUE",
    submittedVenueId: venueId,
    submittedAt: timestamp,
    updatedAt: timestamp,
  };

  upsertCollection("papers", (existing) =>
    existing.map((p) => (p.id === paperId ? updated : p)),
  );

  const coordinators = listAllUsers().filter((user) => user.role === "COORDINATOR");
  for (const coordinator of coordinators) {
    createNotification({
      userId: coordinator.id,
      type: "REVIEW_SUBMITTED",
      title: "Paper submitted to venue",
      message: `"${paper.title}" was submitted to ${venue.name}.`,
      link: `/papers/${paper.id}`,
      sentViaEmail: true,
      sentViaSlack: false,
    });
  }

  return { paper: updated, failedChecks: [] };
}
