import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createUploadTicket, type UploadKind } from '../../../../../lib/uploads';
import { requireRequestUser } from '../../../../../lib/request-auth';

const schema = z.object({
  kind: z.enum(['person_video', 'person_photo', 'product_photo']),
  fileName: z.string().min(1)
});

export async function POST(request: Request) {
  const authResult = await requireRequestUser(request);
  if (!authResult.ok) {
    return authResult.response;
  }

  const payload = await request.json();
  const parsed = schema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues.map(i => i.message).join(', ') }, { status: 400 });
  }

  const result = await createUploadTicket(
    parsed.data.kind as UploadKind,
    parsed.data.fileName,
    authResult.auth.userId
  );
  return NextResponse.json(result);
}
