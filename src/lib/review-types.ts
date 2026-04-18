export type Role = "COORDINATOR" | "MEMBER";

export type PaperStatus =
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "REVISION_REQUESTED"
  | "ACCEPTED"
  | "REJECTED";

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
  | "ROUND_COMPLETE";

export interface UserRecord {
  id: string;
  email: string;
  name: string;
  password: string;
  slackId: string | null;
  role: Role;
  createdAt: string;
  updatedAt: string;
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
}

export interface PaperRecord {
  id: string;
  title: string;
  abstractText: string | null;
  pdfUrl: string;
  overleafUrl: string | null;
  venueId: string | null;
  status: PaperStatus;
  paperType: PaperType | null;
  authorIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ReviewRoundRecord {
  id: string;
  paperId: string;
  roundNumber: number;
  createdAt: string;
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

export interface NotificationRecord {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  link: string | null;
  read: boolean;
  sentViaEmail: boolean;
  sentViaSlack: boolean;
  createdAt: string;
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
}

export interface ReviewerStats {
  reviewer: UserRecord;
  activeAssignments: number;
  totalAssignments: number;
  acceptedAssignments: number;
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
