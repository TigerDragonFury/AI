import { getJobById } from '../../../../../../lib/jobs-repository';
import { requireRequestUser } from '../../../../../../lib/request-auth';
import { getSupabaseServerClient } from '../../../../../../lib/supabase-server';

type Params = { params: Promise<{ id: string }> };

const POLL_INTERVAL_MS = 2500;
const MAX_DURATION_MS = 5 * 60 * 1000;

/** Resolve auth from Bearer header OR ?token= query param (EventSource uses query params). */
async function resolveAuth(request: Request) {
  // Try query param first (EventSource)
  const url = new URL(request.url);
  const tokenParam = url.searchParams.get('token');
  if (tokenParam) {
    const client = getSupabaseServerClient();
    if (client) {
      const { data, error } = await client.auth.getUser(tokenParam);
      if (!error && data.user) {
        return { ok: true as const, userId: data.user.id };
      }
    }
    // Dev fallback
    return { ok: true as const, userId: 'dev-user' };
  }

  // Fall back to normal Bearer auth
  const authResult = await requireRequestUser(request);
  if (!authResult.ok) {
    return { ok: false as const, response: authResult.response };
  }
  return { ok: true as const, userId: authResult.auth.userId };
}

export async function GET(request: Request, { params }: Params) {
  const auth = await resolveAuth(request);
  if (!auth.ok) {
    return auth.response;
  }
  const userId = auth.userId;

  const { id } = await params;

  const encoder = new TextEncoder();

  function sseMessage(event: string, data: unknown): Uint8Array {
    return encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  }

  const stream = new ReadableStream({
    async start(controller) {
      const startTime = Date.now();
      let lastStatus: string | null = null;
      let closed = false;

      // Send heartbeat every POLL_INTERVAL_MS
      const interval = setInterval(async () => {
        if (closed) {
          clearInterval(interval);
          return;
        }

        if (Date.now() - startTime > MAX_DURATION_MS) {
          controller.enqueue(sseMessage('timeout', { message: 'Stream closed after 5 minutes' }));
          controller.close();
          closed = true;
          clearInterval(interval);
          return;
        }

        try {
          const job = await getJobById(id, userId);

          if (!job) {
            controller.enqueue(sseMessage('error', { message: 'Job not found' }));
            controller.close();
            closed = true;
            clearInterval(interval);
            return;
          }

          // Always send a heartbeat
          controller.enqueue(sseMessage('heartbeat', { ts: Date.now() }));

          // Only send status update when it changes
          if (job.status !== lastStatus) {
            lastStatus = job.status;
            controller.enqueue(sseMessage('status', { jobId: id, status: job.status, job }));

            // Terminal states — close stream
            if (job.status === 'published' || job.status === 'failed') {
              clearInterval(interval);
              setTimeout(() => {
                if (!closed) {
                  controller.close();
                  closed = true;
                }
              }, 500);
            }
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Unknown error';
          try {
            controller.enqueue(sseMessage('error', { message }));
          } catch {
            // controller already closed
          }
        }
      }, POLL_INTERVAL_MS);

      // Send initial status immediately
      try {
        const job = await getJobById(id, userId);
        if (job) {
          lastStatus = job.status;
          controller.enqueue(sseMessage('status', { jobId: id, status: job.status, job }));
        } else {
          controller.enqueue(sseMessage('error', { message: 'Job not found' }));
          controller.close();
          closed = true;
          clearInterval(interval);
        }
      } catch {
        controller.enqueue(sseMessage('error', { message: 'Failed to load job' }));
        controller.close();
        closed = true;
        clearInterval(interval);
      }

      // Clean up when client disconnects
      request.signal.addEventListener('abort', () => {
        closed = true;
        clearInterval(interval);
        try { controller.close(); } catch { /* already closed */ }
      });
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no'
    }
  });
}
