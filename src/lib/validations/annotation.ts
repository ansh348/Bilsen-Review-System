import { z } from "zod";

const normalized = z.number().min(0).max(1);

const rectSchema = z.object({
  x: normalized,
  y: normalized,
  width: z.number().min(0).max(1),
  height: z.number().min(0).max(1),
});

const strokeSchema = z.object({
  points: z.array(z.array(z.number()).min(2).max(3)).min(1).max(2000),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  size: z.number().min(0.0005).max(0.05),
});

const colorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const pageNumberSchema = z.number().int().min(1).max(2000);
const severitySchema = z.enum([
  "CRITICAL",
  "MAJOR",
  "MINOR",
  "SUGGESTION",
  "QUESTION",
]);

const baseFields = {
  pageNumber: pageNumberSchema,
  assignmentId: z.string().min(1).optional().nullable(),
};

const highlightCreateSchema = z.object({
  ...baseFields,
  kind: z.literal("HIGHLIGHT"),
  highlight: z.object({
    rects: z.array(rectSchema).min(1).max(50),
    text: z.string().min(1).max(5000),
    color: colorSchema,
  }),
});

const doodleCreateSchema = z.object({
  ...baseFields,
  kind: z.literal("DOODLE"),
  doodle: z.object({
    strokes: z.array(strokeSchema).min(1).max(20),
  }),
});

const commentCreateSchema = z.object({
  ...baseFields,
  kind: z.literal("COMMENT"),
  comment: z.object({
    anchor: z.object({ x: normalized, y: normalized }),
    text: z.string().max(5000),
    severity: severitySchema.optional(),
    parentId: z.string().min(1).optional().nullable(),
  }),
});

export const createAnnotationSchema = z.discriminatedUnion("kind", [
  highlightCreateSchema,
  doodleCreateSchema,
  commentCreateSchema,
]);

export const updateAnnotationSchema = z.object({
  comment: z
    .object({
      text: z.string().max(5000).optional(),
      severity: severitySchema.optional(),
    })
    .refine((v) => v.text !== undefined || v.severity !== undefined, {
      message: "Provide text or severity",
    })
    .optional(),
  highlight: z
    .object({
      color: colorSchema,
    })
    .optional(),
});

export type CreateAnnotationInput = z.infer<typeof createAnnotationSchema>;
export type UpdateAnnotationInput = z.infer<typeof updateAnnotationSchema>;
