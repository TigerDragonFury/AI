import { NextResponse, type NextRequest } from 'next/server';

/**
 * Simple sliding-window rate limiter for API routes.
 * In-memory — adequate for single-instance deployments.
 * Replace with a Redis-backed limiter for multi-instance production.
 */

type WindowEntry = { count: number; windowStart: number };
const windows = new Map<string, WindowEntry>();

const WINDOW_MS = 60_000; // 1 minute
const MAX_REQUESTS = 120; // requests per window per IP
const STRICT_MAX = 30;    // stricter limit for write / auth endpoints

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    'unknown'
  );
}

function isRateLimited(key: string, limit: number): boolean {
  const now = Date.now();
  const entry = windows.get(key);

  if (!entry || now - entry.windowStart > WINDOW_MS) {
    windows.set(key, { count: 1, windowStart: now });
    return false;
  }

  entry.count += 1;

  if (entry.count > limit) {
    return true;
  }

  return false;
}

// Clean up stale entries every 5 minutes to prevent unbounded memory growth
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of windows) {
      if (now - entry.windowStart > WINDOW_MS * 2) {
        windows.delete(key);
      }
    }
  }, 5 * 60_000);
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Only rate-limit API routes
  if (!pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  const ip = getClientIp(request);
  const method = request.method;

  // Stricter limit for write operations and auth routes
  const isWriteOrAuth =
    method === 'POST' ||
    method === 'PUT' ||
    method === 'PATCH' ||
    method === 'DELETE' ||
    pathname.includes('/auth') ||
    pathname.includes('/oauth');

  const limit = isWriteOrAuth ? STRICT_MAX : MAX_REQUESTS;
  const windowKey = `${ip}:${isWriteOrAuth ? 'write' : 'read'}`;

  if (isRateLimited(windowKey, limit)) {
    return new NextResponse(
      JSON.stringify({ error: 'Too many requests. Please try again later.' }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': String(Math.ceil(WINDOW_MS / 1000))
        }
      }
    );
  }

  const response = NextResponse.next();

  // Add security headers to all API responses
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  return response;
}

export const config = {
  matcher: '/api/:path*'
};
