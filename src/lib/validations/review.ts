import { z } from "zod";

const paperStatuses = [
  "SUBMITTED",
  "UNDER_REVIEW",
  "REVIEW_COMPLETE",
  "REVISION_REQUESTED",
  "ACCEPTED",
  "REJECTED",
  "SUBMITTED_TO_VENUE",
] as const;

const paperTypes = [
  "RESEARCH",
  "SURVEY",
  "TOOL",
  "EXPERIENCE_REPORT",
  "OTHER",
] as const;

const recommendations = [
  "ACCEPT",
  "MINOR_REVISION",
  "MAJOR_REVISION",
  "REJECT",
] as const;

const roles = ["COORDINATOR", "MEMBER"] as const;

const paperBaseSchema = z.object({
  title: z.string().min(3),
  abstractText: z.string().optional().nullable(),
  pdfUrl: z.string().optional().nullable(),
  overleafUrl: z.string().optional().nullable(),
  venueId: z.string().optional().nullable(),
  paperType: z.enum(paperTypes).optional().nullable(),
  uploadId: z
    .string()
    .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
    .optional(),
  pageCount: z.number().int().positive().optional().nullable(),
  extractedSections: z.array(z.string()).optional(),
  extractedReferences: z.array(z.string()).optional(),
  extractedAuthors: z.array(z.string()).optional(),
  extractedAffiliations: z.array(z.string()).optional(),
});

export const createPaperSchema = paperBaseSchema.refine(
  (data) => Boolean(data.uploadId) || Boolean(data.pdfUrl && data.pdfUrl.trim()),
  { message: "Either uploadId (file upload) or pdfUrl is required", path: ["pdfUrl"] }
);

export const updatePaperSchema = paperBaseSchema.partial().extend({
  status: z.enum(paperStatuses).optional(),
});

export const createVenueSchema = z.object({
  name: z.string().min(2),
  track: z.string().optional().nullable(),
  pageLimit: z.number().int().positive().optional().nullable(),
  abstractWordLimit: z.number().int().positive().optional().nullable(),
  requiredSections: z.array(z.string().min(1)).optional(),
  referenceFormat: z.string().optional().nullable(),
  anonymityRequired: z.boolean().optional(),
  submissionDeadline: z.string().optional().nullable(),
  paperTypes: z.array(z.enum(paperTypes)).optional(),
});

export const assignReviewersSchema = z.object({
  reviewers: z
    .array(
      z.object({
        reviewerId: z.string().min(1),
        deadline: z.string().min(1),
      })
    )
    .min(1),
});

export const declineAssignmentSchema = z.object({
  reason: z.string().min(3),
});

export const requestExtensionSchema = z.object({
  requestedDate: z.string().min(1),
});

export const approveExtensionSchema = z.object({
  newDeadline: z.string().min(1),
  approved: z.boolean().default(true),
});

export const reviewSubmissionSchema = z.object({
  comments: z.string().min(5),
  structuredFeedback: z.record(z.string(), z.string()).optional().nullable(),
  overallScore: z.number().int().min(1).max(5).optional().nullable(),
  recommendation: z.enum(recommendations).optional().nullable(),
});

export const reviewUpdateSchema = reviewSubmissionSchema.partial();

export const rateReviewSchema = z.object({
  qualityScore: z.number().int().min(1).max(5),
  quantityScore: z.number().int().min(1).max(5),
  timelinessScore: z.number().int().min(1).max(5),
  comment: z.string().optional().nullable(),
});

export const userUpdateSchema = z.object({
  name: z.string().min(2).optional(),
  role: z.enum(roles).optional(),
  slackId: z.string().optional().nullable(),
  expertise: z.array(z.string().min(1).max(60)).max(15).optional(),
});

export const linkSlackSchema = z.object({
  slackId: z.string().min(2),
});

export const markReadSchema = z.object({
  read: z.boolean().default(true),
});

export const complianceCheckSchema = z.object({
  paperId: z.string().min(1),
  extractedText: z.string().optional(),
  pageCount: z.number().int().positive().optional().nullable(),
  metadata: z
    .object({
      author: z.string().optional().nullable(),
      company: z.string().optional().nullable(),
    })
    .optional(),
});

export const aiReviewSchema = z.object({
  extractedText: z.string().min(20),
});
