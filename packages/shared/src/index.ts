import { z } from 'zod';

export const jobStatuses = [
  'queued',
  'processing',
  'awaiting_approval',
  'approved',
  'published',
  'failed'
] as const;

export type JobStatus = (typeof jobStatuses)[number];

export const platformValues = [
  'TikTok',
  'Facebook',
  'Instagram',
  'YouTube',
  'X',
  'LinkedIn'
] as const;

export type PlatformValue = (typeof platformValues)[number];

export const createJobSchema = z
  .object({
    personSourceType: z.enum(['video', 'photo']),
    personSourceName: z.string().min(1),
    personSourceUrl: z.string().optional(),
    productPhotoName: z.string().min(1).optional(),
    productPhotoUrl: z.string().optional(),
    productDescription: z.string().min(1).optional(),
    tone: z.string().optional(),
    targetPlatforms: z.array(z.enum(platformValues)).default([])
  })
  .superRefine((value, ctx) => {
    if (!value.productPhotoName && !value.productDescription) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Provide productPhotoName or productDescription.'
      });
    }
  });

export type CreateJobInput = z.infer<typeof createJobSchema>;

export const jobRecordSchema = z.object({
  id: z.string(),
  userId: z.string(),
  createdAt: z.string(),
  status: z.enum(jobStatuses),
  personSourceType: z.enum(['video', 'photo']),
  personSourceName: z.string(),
  personSourceUrl: z.string().optional(),
  productPhotoName: z.string().optional(),
  productPhotoUrl: z.string().optional(),
  productDescription: z.string().optional(),
  tone: z.string().optional(),
  targetPlatforms: z.array(z.enum(platformValues)).default([]),
  generatedVideoUrl: z.string().optional(),
  caption: z.string().optional(),
  errorMessage: z.string().optional()
});

export type JobRecord = z.infer<typeof jobRecordSchema>;
