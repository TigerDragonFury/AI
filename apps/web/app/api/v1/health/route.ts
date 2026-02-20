import { NextResponse } from 'next/server';
import { getSupabaseServerClient, isSupabaseConfigured } from '../../../../lib/supabase-server';

type ServiceStatus = 'ok' | 'degraded' | 'unavailable';

interface HealthCheckResult {
  status: ServiceStatus;
  latencyMs: number;
  error?: string;
}

async function checkSupabase(): Promise<HealthCheckResult> {
  if (!isSupabaseConfigured()) {
    return { status: 'degraded', latencyMs: 0, error: 'Supabase not configured — using in-memory fallback' };
  }

  const start = Date.now();
  try {
    const client = getSupabaseServerClient();
    if (!client) {
      return { status: 'unavailable', latencyMs: 0, error: 'Client construction failed' };
    }

    // Lightweight ping: count the users table
    const { error } = await client.from('users').select('id', { head: true, count: 'exact' });
    const latencyMs = Date.now() - start;

    if (error) {
      return { status: 'degraded', latencyMs, error: error.message };
    }

    return { status: 'ok', latencyMs };
  } catch (err) {
    return {
      status: 'unavailable',
      latencyMs: Date.now() - start,
      error: err instanceof Error ? err.message : 'Unknown error'
    };
  }
}

async function checkRedis(): Promise<HealthCheckResult> {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    return { status: 'degraded', latencyMs: 0, error: 'REDIS_URL not configured' };
  }

  const start = Date.now();
  try {
    // Attempt a TCP connection to Redis via fetch (edge-compatible approach)
    // For a full check in Node.js runtime, we use a direct connect
    const { createConnection } = await import('net');
    const parsed = new URL(redisUrl);

    await new Promise<void>((resolve, reject) => {
      const socket = createConnection(
        { host: parsed.hostname, port: Number(parsed.port || 6379) },
        resolve
      );
      socket.setTimeout(3000);
      socket.on('timeout', () => reject(new Error('Connection timeout')));
      socket.on('error', reject);
      socket.on('connect', () => {
        socket.destroy();
        resolve();
      });
    });

    return { status: 'ok', latencyMs: Date.now() - start };
  } catch (err) {
    return {
      status: 'unavailable',
      latencyMs: Date.now() - start,
      error: err instanceof Error ? err.message : 'Unknown error'
    };
  }
}

export async function GET() {
  const [supabase, redis] = await Promise.all([checkSupabase(), checkRedis()]);

  const statuses = [supabase.status, redis.status];
  const anyUnavailable = statuses.includes('unavailable' as ServiceStatus);
  const anyDegraded = statuses.includes('degraded' as ServiceStatus);
  const overallStatus: ServiceStatus = anyUnavailable || anyDegraded ? 'degraded' : 'ok';
  const httpStatus = anyUnavailable ? 503 : 200;

  return NextResponse.json(
    {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version ?? '0.0.0',
      services: { supabase, redis }
    },
    { status: httpStatus }
  );
}
