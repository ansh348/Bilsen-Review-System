export type Role = "COORDINATOR" | "MEMBER";

export type PaperStatus =
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "REVIEW_COMPLETE"
  | "REVISION_REQUESTED"
  | "ACCEPTED"
  | "REJECTED"
  | "SUBMITTED_TO_VENUE";

export type PaperType =
  | "RESEARCH"
  | "SURVEY"
  | "TOOL"
  | "EXPERIENCE_REPORT"
  | "OTHER";

export type AssignmentStatus =
  | "PENDING"
  | "ACCEPTED"
  | "DECLINED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "OVERDUE"
  | "EXTENSION_REQUESTED";

export type Recommendation =
  | "ACCEPT"
  | "MINOR_REVISION"
  | "MAJOR_REVISION"
  | "REJECT";

export type ComplianceCheckType =
  | "PAGE_LIMIT"
  | "ABSTRACT_WORD_COUNT"
  | "REQUIRED_SECTIONS"
  | "REFERENCE_FORMAT"
  | "ANONYMITY_CHECK"
  | "METADATA_CHECK"
  | "PDF_METADATA_ANONYMITY"
  | "TOOL_LINK_ANONYMITY"
  | "DYNAMIC_CHECKLIST"
  | "DESK_REJECT_RISK"
  | "AI_FULL_REVIEW"
  | "AI_REFERENCE_CHECK"
  | "CHECKLIST";

export type NotificationType =
  | "ASSIGNMENT_NEW"
  | "ASSIGNMENT_ACCEPTED"
  | "ASSIGNMENT_DECLINED"
  | "DEADLINE_REMINDER"
  | "DEADLINE_OVERDUE"
  | "REVIEW_SUBMITTED"
  | "RATING_RECEIVED"
  | "COMPLIANCE_RESULT"
  | "EXTENSION_REQUESTED"
  | "EXTENSION_APPROVED"
  | "EXTENSION_DENIED"
  | "ROUND_COMPLETE"
  | "REVISION_REQUESTED"
  | "PAPER_ACCEPTED"
  | "PAPER_REJECTED";

export interface UserRecord {
  id: string;
  email: string;
  name: string;
  password: string;
  slackId: string | null;
  role: Role;
  expertise?: string[];
  affiliation?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SpecialRequiredSection {
  name: string;
  placement?: string | null;
  countsTowardLimit?: boolean | null;
  deskRejectIfMissing?: boolean | null;
}

export interface VenueReviewPolicy {
  blindness?: string | null;
  clearPdfMetadata?: boolean | null;
  acknowledgmentsAllowed?: boolean | null;
  selfCitationPolicy?: string | null;
  arxivDuringReview?: string | null;
  socialMediaDiscussion?: string | null;
  anonymizeToolLinks?: boolean | null;
  submissionLimitPerAuthor?: number | string | null;
}

export interface VenueAuthorshipPolicy {
  aiAuthorshipAllowed?: boolean | null;
  aiUseDisclosureRequired?: boolean | null;
  plagiarismPolicy?: string | null;
  overlapPolicy?: string | null;
  ethicsReviewRequired?: boolean | null;
  coiDeclarationRequired?: boolean | null;
  rebuttalPhase?: boolean | null;
  rebuttalWordLimit?: number | null;
  reviseAndResubmit?: boolean | null;
  decisionTypes?: string[];
}

export interface VenueDates {
  cycle?: string | null;
  abstractDeadline?: string | null;
  fullPaperDeadline?: string | null;
  cycle2Deadline?: string | null;
  notificationDate?: string | null;
  cameraReadyDeadline?: string | null;
  conferenceDates?: string | null;
  notes?: string | null;
}

export interface VenueSupplementaryPolicy {
  allowed?: boolean | null;
  codeAllowed?: boolean | null;
  reviewersRequired?: boolean | null;
  pageLimit?: number | null;
}

export interface VenueSpecialRequirements {
  reproducibilityChecklist?: boolean | null;
  artifactEvaluation?: boolean | null;
  registeredReports?: boolean | null;
  mandatoryLimitationsSection?: boolean | null;
  mandatoryBroaderImpact?: boolean | null;
  mandatoryPaperChecklist?: boolean | null;
  mandatoryGenAIDisclosure?: boolean | null;
  mandatoryDataAvailability?: boolean | null;
  mandatoryStructuredAbstract?: boolean | null;
  impactFactor?: number | null;
  other?: string[];
}

export interface VenueReferenceFormatDetails {
  style?: string | null;
  type?: string | null;
  notes?: string | null;
}

export interface VenueRecord {
  id: string;
  name: string;
  track: string | null;
  pageLimit: number | null;
  abstractWordLimit: number | null;
  requiredSections: string[];
  referenceFormat: string | null;
  anonymityRequired: boolean;
  submissionDeadline: string | null;
  paperTypes: PaperType[];
  createdAt: string;
  updatedAt: string;

  // Optional rich fields sourced from venues_comprehensive.json. Older venue
  // records (e.g. CVPR, OSDI) may not carry these — code MUST treat them as
  // potentially undefined.
  acronym?: string | null;
  fullName?: string | null;
  type?: "conference" | "journal" | null;
  domain?: string | null;
  publisher?: string | null;
  coreRanking?: string | null;
  edition?: string | null;
  template?: string | null;

  referencesCountTowardLimit?: boolean | null;
  extraRefPages?: number | null;
  appendixCountsTowardLimit?: boolean | null;
  cameraReadyPageLimit?: number | null;

  conventionalSections?: string[];
  specialRequiredSections?: SpecialRequiredSection[];

  deskRejectCriteria?: string[];

  abstractStructuredRequired?: boolean | null;
  abstractRegistrationRequired?: boolean | null;
  referenceFormatDetails?: VenueReferenceFormatDetails | null;

  reviewPolicy?: VenueReviewPolicy | null;
  authorshipPolicy?: VenueAuthorshipPolicy | null;
  dates?: VenueDates | null;
  supplementaryPolicy?: VenueSupplementaryPolicy | null;
  specialRequirements?: VenueSpecialRequirements | null;
}

export interface PaperRecord {
  id: string;
  title: string;
  abstractText: string | null;
  pdfUrl: string | null;
  pdfPath?: string | null;
  pageCount?: number | null;
  overleafUrl: string | null;
  venueId: string | null;
  status: PaperStatus;
  paperType: PaperType | null;
  authorIds: string[];
  submittedVenueId?: string | null;
  submittedAt?: string | null;
  extractedSections?: string[];
  extractedReferences?: string[];
  extractedAuthors?: string[];
  extractedAffiliations?: string[];
  extractedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReviewRoundRecord {
  id: string;
  paperId: string;
  roundNumber: number;
  createdAt: string;
  revisionNote?: string | null;
  priorReviewerIds?: string[];
}

export interface ReviewAssignmentRecord {
  id: string;
  reviewRoundId: string;
  reviewerId: string;
  deadline: string;
  status: AssignmentStatus;
  declineReason: string | null;
  extensionRequestedTo: string | null;
  assignedAt: string;
  respondedAt: string | null;
  completedAt: string | null;
}

export interface ReviewRecord {
  id: string;
  assignmentId: string;
  comments: string;
  structuredFeedback: Record<string, string> | null;
  overallScore: number | null;
  recommendation: Recommendation | null;
  submittedAt: string;
  updatedAt: string;
}

export interface ReviewerRatingRecord {
  id: string;
  reviewId: string;
  raterId: string;
  reviewerId: string;
  qualityScore: number;
  quantityScore: number;
  timelinessScore: number;
  comment: string | null;
  createdAt: string;
}

export interface ComplianceCheckRecord {
  id: string;
  paperId: string;
  checkType: ComplianceCheckType;
  passed: boolean;
  details: Record<string, unknown>;
  checkedAt: string;
}

export interface AiClaim {
  point: string;
  quote: string;
  unsupported: boolean;
}

export interface AiReviewDraftRecord {
  summary: string;
  strengths: AiClaim[];
  concerns: AiClaim[];
  recommendation: string;
  unsupportedCount: number;
}

export interface AiFinalReportRecord {
  id: string;
  paperId: string;
  reviewIds: string[];
  consensusSummary: string;
  agreedStrengths: string[];
  agreedConcerns: string[];
  divergences: string[];
  overallRecommendation: string;
  reviewerCount: number;
  createdAt: string;
}

export interface NotificationRecord {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  link: string | null;
  overleafUrl?: string | null;
  read: boolean;
  sentViaEmail: boolean;
  sentViaSlack: boolean;
  createdAt: string;
}

export interface PaperVersionRecord {
  id: string;
  paperId: string;
  versionNumber: number;
  title: string;
  abstractText: string | null;
  pdfPath: string | null;
  pdfUrl: string | null;
  pageCount: number | null;
  extractedSections?: string[];
  extractedReferences?: string[];
  extractedAuthors?: string[];
  extractedAffiliations?: string[];
  supersededAt: string;
  reason: "REVISION" | "MANUAL_REUPLOAD";
}

export interface PaperDetails {
  paper: PaperRecord;
  authors: UserRecord[];
  venue: VenueRecord | null;
  rounds: Array<{
    round: ReviewRoundRecord;
    assignments: ReviewAssignmentRecord[];
    reviews: ReviewRecord[];
  }>;
  complianceChecks: ComplianceCheckRecord[];
  versions: PaperVersionRecord[];
}

export interface ReviewerStats {
  reviewer: UserRecord;
  activeAssignments: number;
  totalAssignments: number;
  acceptedAssignments: number;
  declinedAssignments: number;
  completedAssignments: number;
  overdueAssignments: number;
  acceptanceRate: number;
  onTimeRate: number;
  averageQuality: number;
  averageQuantity: number;
  averageTimeliness: number;
  averageOverallRating: number;
}

export interface PaperListItem {
  paper: PaperRecord;
  venue: VenueRecord | null;
  authors: UserRecord[];
  latestRoundNumber: number;
  pendingAssignments: number;
  completedAssignments: number;
  complianceSummary: { passed: number; total: number } | null;
}

export type AnalyticsPeriod = "monthly" | "yearly" | "overall";

export interface AssignmentWithContext {
  assignment: ReviewAssignmentRecord;
  round: ReviewRoundRecord;
  paper: PaperRecord;
  reviewer: UserRecord | null;
  review: ReviewRecord | null;
}

export type AnnotationKind = "HIGHLIGHT" | "DOODLE" | "COMMENT";
export type AnnotationVisibility = "PRIVATE" | "SHARED";

export interface AnnotationRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface AnnotationStroke {
  points: number[][];
  color: string;
  size: number;
}

export interface AnnotationHighlight {
  rects: AnnotationRect[];
  text: string;
  color: string;
}

export interface AnnotationDoodle {
  strokes: AnnotationStroke[];
}

export type CommentSeverity =
  | "CRITICAL"
  | "MAJOR"
  | "MINOR"
  | "SUGGESTION"
  | "QUESTION";

export interface AnnotationComment {
  anchor: { x: number; y: number };
  text: string;
  severity?: CommentSeverity;
  parentId?: string | null;
}

export interface AnnotationRecord {
  id: string;
  paperId: string;
  authorId: string;
  assignmentId?: string | null;
  reviewId?: string | null;
  kind: AnnotationKind;
  pageNumber: number;
  highlight?: AnnotationHighlight;
  doodle?: AnnotationDoodle;
  comment?: AnnotationComment;
  visibility: AnnotationVisibility;
  createdAt: string;
  updatedAt: string;
}
