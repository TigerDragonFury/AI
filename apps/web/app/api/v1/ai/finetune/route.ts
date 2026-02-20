import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRequestUser } from '../../../../../lib/request-auth';
import { getSupabaseServerClient } from '../../../../../lib/supabase-server';

const createSchema = z.object({
  baseModel:  z.enum(['gpt-4o-mini-2024-07-18', 'gpt-3.5-turbo-0125', 'gpt-4o-2024-08-06']),
  fileId:     z.string().min(1),   // OpenAI file ID (upload file first)
  epochs:     z.number().int().min(1).max(10).default(3),
});

// GET /api/v1/ai/finetune — list fine-tune jobs for user
export async function GET(request: Request) {
  const auth = await requireRequestUser(request);
  if (!auth.ok) return auth.response;
  const { userId } = auth.auth;

  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from('fine_tune_jobs')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Sync status from OpenAI for any running jobs
  const runningJobs = (data ?? []).filter((j) => j.status === 'running' && j.provider_job_id);
  const apiKey = process.env.OPENAI_API_KEY ?? '';
  await Promise.all(
    runningJobs.map(async (job) => {
      try {
        const resp = await fetch(`https://api.openai.com/v1/fine_tuning/jobs/${job.provider_job_id}`, {
          headers: { authorization: `Bearer ${apiKey}` },
        });
        if (resp.ok) {
          const ft = (await resp.json()) as {
            status: string;
            fine_tuned_model?: string;
            trained_tokens?: number;
            error?: { message: string };
          };
          const newStatus =
            ft.status === 'succeeded' ? 'succeeded' :
            ft.status === 'failed'    ? 'failed' :
            ft.status === 'cancelled' ? 'cancelled' : 'running';
          await supabase.from('fine_tune_jobs').update({
            status:            newStatus,
            fine_tuned_model:  ft.fine_tuned_model,
            training_examples: ft.trained_tokens,
            error_message:     ft.error?.message,
            updated_at:        new Date().toISOString(),
          }).eq('id', job.id);
        }
      } catch { /* ignore sync errors */ }
    })
  );

  return NextResponse.json(data);
}

// POST /api/v1/ai/finetune — create fine-tune job
export async function POST(request: Request) {
  const auth = await requireRequestUser(request);
  if (!auth.ok) return auth.response;
  const { userId } = auth.auth;

  const body = createSchema.safeParse(await request.json());
  if (!body.success) return NextResponse.json({ error: body.error.issues.map(i => i.message).join(', ') }, { status: 422 });

  const apiKey = process.env.OPENAI_API_KEY ?? '';
  if (!apiKey) return NextResponse.json({ error: 'OPENAI_API_KEY not configured' }, { status: 500 });

  // Submit to OpenAI
  const ftResp = await fetch('https://api.openai.com/v1/fine_tuning/jobs', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      training_file: body.data.fileId,
      model:         body.data.baseModel,
      hyperparameters: { n_epochs: body.data.epochs },
    }),
  });

  if (!ftResp.ok) {
    const err = await ftResp.text();
    return NextResponse.json({ error: err }, { status: 502 });
  }

  const ft = (await ftResp.json()) as { id: string; status: string };

  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from('fine_tune_jobs')
    .insert({
      user_id:          userId,
      provider_job_id:  ft.id,
      base_model:       body.data.baseModel,
      training_file_id: body.data.fileId,
      status:           'running',
      epochs:           body.data.epochs,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
