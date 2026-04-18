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

interface PaperFilters {
  status?: string | null;
  venueId?: string | null;
  authorId?: string | null;
}

interface PaperCreateInput {
  title: string;
  abstractText?: string | null;
  pdfUrl: string;
  overleafUrl?: string | null;
  venueId?: string | null;
  paperType?: PaperType | null;
  authorId: string;
}

interface PaperUpdateInput {
  title?: string;
  abstractText?: string | null;
  pdfUrl?: string;
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
}

function nowIso() {
  return new Date().toISOString();
}

function ensureUnique(values: string[]) {
  return [...new Set(values)];
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

export function createPaper(input: PaperCreateInput) {
  if (!input.title.trim()) {
    throw new Error("Paper title is required");
  }

  if (!input.pdfUrl.trim()) {
    throw new Error("PDF URL is required");
  }

  if (input.venueId && !getVenueById(input.venueId)) {
    throw new Error("Selected venue does not exist");
  }

  const timestamp = nowIso();
  const paper: PaperRecord = {
    id: crypto.randomUUID(),
    title: input.title.trim(),
    abstractText: input.abstractText?.trim() || null,
    pdfUrl: input.pdfUrl.trim(),
    overleafUrl: input.overleafUrl?.trim() || null,
    venueId: input.venueId || null,
    status: "SUBMITTED",
    paperType: input.paperType ?? null,
    authorIds: [input.authorId],
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
    try { runComplianceChecks({ paperId: paper.id }); } catch { /* non-blocking */ }
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
  };
}

export function updatePaper(paperId: string, input: PaperUpdateInput) {
  const oldVenueId = getPaperById(paperId)?.venueId;
  let updatedPaper: PaperRecord | null = null;

  upsertCollection("papers", (papers) =>
    papers.map((paper) => {
      if (paper.id !== paperId) {
        return paper;
      }

      if (input.venueId && !getVenueById(input.venueId)) {
        throw new Error("Selected venue does not exist");
      }

      updatedPaper = {
        ...paper,
        title: input.title?.trim() ?? paper.title,
        abstractText:
          input.abstractText === undefined
            ? paper.abstractText
            : input.abstractText?.trim() || null,
        pdfUrl: input.pdfUrl?.trim() ?? paper.pdfUrl,
        overleafUrl:
          input.overleafUrl === undefined
            ? paper.overleafUrl
            : input.overleafUrl?.trim() || null,
        venueId: input.venueId === undefined ? paper.venueId : input.venueId,
        status: input.status ?? paper.status,
        paperType:
          input.paperType === undefined ? paper.paperType : input.paperType,
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
    try { runComplianceChecks({ paperId }); } catch { /* non-blocking */ }
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
  const nextRoundNumber =
    rounds.length === 0
      ? 1
      : Math.max(...rounds.map((round) => round.roundNumber)) + 1;

  const round: ReviewRoundRecord = {
    id: crypto.randomUUID(),
    paperId,
    roundNumber: nextRoundNumber,
    createdAt: nowIso(),
  };

  const allRounds = readCollection("rounds");
  allRounds.push(round);
  writeCollection("rounds", allRounds);

  updatePaper(paperId, { status: "UNDER_REVIEW" });
  return round;
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

    createNotification({
      userId: reviewer.id,
      type: "ASSIGNMENT_NEW",
      title: "New review assignment",
      message: `You were assigned to review "${paper.title}" (round ${round.roundNumber}).`,
      link: `/reviews/${assignment.id}`,
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

export function getOverviewAnalytics() {
  const assignments = refreshOverdueAssignments();
  const papers = readCollection("papers");
  const now = Date.now();
  const sevenDaysFromNow = now + 7 * 24 * 60 * 60 * 1000;

  return {
    totalPapers: papers.length,
    activePapers: papers.filter((paper) => paper.status === "UNDER_REVIEW").length,
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
  const assignments = listAssignmentsForReviewer(reviewerId);
  const ratings = getRatingsForReviewer(reviewerId);

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

export function runComplianceChecks(input: ComplianceInput) {
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
  const text = getPaperTextForCompliance(paper, input.extractedText);
  const pageCount = input.pageCount ?? null;
  const metadataAuthor = input.metadata?.author?.trim() || "";
  const metadataCompany = input.metadata?.company?.trim() || "";

  const checks: Array<{
    checkType: ComplianceCheckType;
    passed: boolean;
    details: Record<string, unknown>;
  }> = [];

  checks.push({
    checkType: "PAGE_LIMIT",
    passed:
      venue.pageLimit === null ||
      pageCount === null ||
      Number(pageCount) <= Number(venue.pageLimit),
    details: {
      pageCount,
      pageLimit: venue.pageLimit,
      note:
        pageCount === null ? "Page count not provided; check skipped." : undefined,
    },
  });

  checks.push({
    checkType: "ABSTRACT_WORD_COUNT",
    passed:
      venue.abstractWordLimit === null || abstractWordCount <= venue.abstractWordLimit,
    details: {
      abstractWordCount,
      abstractWordLimit: venue.abstractWordLimit,
    },
  });

  const missingSections = venue.requiredSections.filter(
    (section) => !text.includes(section.toLowerCase())
  );
  checks.push({
    checkType: "REQUIRED_SECTIONS",
    passed: missingSections.length === 0,
    details: {
      requiredSections: venue.requiredSections,
      missingSections,
    },
  });

  const metadataPass =
    !venue.anonymityRequired ||
    (metadataAuthor.length === 0 && metadataCompany.length === 0);
  checks.push({
    checkType: "METADATA_CHECK",
    passed: metadataPass,
    details: {
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
  checks.push({
    checkType: "ANONYMITY_CHECK",
    passed: !venue.anonymityRequired || allFlags.length === 0,
    details: {
      anonymityRequired: venue.anonymityRequired,
      keywordFlags,
      patternFlags,
      flags: allFlags,
    },
  });

  // Reference format check
  if (venue.referenceFormat) {
    const hasExtractedText = Boolean(input.extractedText?.trim());
    if (!hasExtractedText) {
      checks.push({
        checkType: "REFERENCE_FORMAT",
        passed: true,
        details: {
          expectedFormat: venue.referenceFormat,
          note: "Full text not provided; reference format not verified.",
        },
      });
    } else {
      const hasReferencesSection = /\b(references|bibliography)\b/.test(text);
      let formatMatched = false;
      let detectedHint = "unknown";

      const format = venue.referenceFormat.toUpperCase();
      if (format === "ACM") {
        // ACM uses author-year: (Author, 2024) or (Author et al., 2024)
        formatMatched = /\([A-Z][a-z]+(?:\s+et\s+al\.?)?,?\s*\d{4}\)/.test(input.extractedText!);
        detectedHint = formatMatched ? "ACM (author-year)" : "no ACM citations found";
      } else if (format === "IEEE") {
        // IEEE uses numbered brackets: [1], [2], [1, 3]
        formatMatched = /\[\d+(?:\s*,\s*\d+)*\]/.test(input.extractedText!);
        detectedHint = formatMatched ? "IEEE (numbered)" : "no IEEE citations found";
      } else {
        // Unknown format — just check for a references section
        formatMatched = hasReferencesSection;
        detectedHint = hasReferencesSection ? "references section present" : "no references section found";
      }

      checks.push({
        checkType: "REFERENCE_FORMAT",
        passed: hasReferencesSection && formatMatched,
        details: {
          expectedFormat: venue.referenceFormat,
          hasReferencesSection,
          detectedHint,
        },
      });
    }
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
      "Problem framing appears clear and scoped.",
      "The draft contains a concrete method section.",
      "The paper structure is generally coherent.",
    ],
    concerns: [
      "Add stronger empirical evaluation details.",
      "Clarify threat model and limitations.",
      "Improve related work positioning.",
    ],
    recommendation: "MINOR_REVISION",
    estimatedWordCount: wordCount,
  };
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
