import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { z } from 'zod';

const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.status(200).json({ ok: true, service: 'api' });
});

app.post('/api/v1/jobs/create', (req, res) => {
  const schema = z
    .object({
      personVideoUploadId: z.string().min(1).optional(),
      personPhotoUploadId: z.string().min(1).optional(),
      productPhotoUploadId: z.string().min(1).optional(),
      productDescription: z.string().min(1).optional(),
      tone: z.string().optional(),
      targetPlatforms: z.array(z.string()).default([])
    })
    .superRefine((value, ctx) => {
      if (!value.personVideoUploadId && !value.personPhotoUploadId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Provide either personVideoUploadId or personPhotoUploadId.'
        });
      }

      if (!value.productDescription && !value.productPhotoUploadId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Provide either productDescription or productPhotoUploadId.'
        });
      }
    });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  return res.status(202).json({
    status: 'queued',
    message: 'Job accepted by API scaffold',
    sourceMode: parsed.data.personVideoUploadId ? 'video' : 'photo',
    payload: parsed.data
  });
});

const port = Number(process.env.PORT || 3001);
app.listen(port, () => {
  console.log(`API listening on :${port}`);
});
