/**
 * Resilient HTTP client with retry, back-off and rate-limit handling.
 *
 * Every platform adapter composes this class rather than calling fetch()
 * directly, ensuring consistent error handling, timeout behaviour and
 * automatic retries across all third-party integrations.
 */

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface HttpClientOptions {
  /** Human-readable name used in log messages (e.g. "TikTok") */
  name: string;
  /** Base URL that is prepended to every relative path */
  baseUrl: string;
  /** Default headers sent with every request */
  defaultHeaders?: Record<string, string>;
  /** Total timeout per attempt in ms (default 15 000) */
  timeoutMs?: number;
  /** Maximum number of attempts including the first one (default 3) */
  maxAttempts?: number;
  /** Initial back-off delay in ms – doubles after each retry (default 500) */
  initialBackoffMs?: number;
  /** Maximum back-off delay cap in ms (default 10 000) */
  maxBackoffMs?: number;
}

export interface HttpRequestOptions {
  method?: HttpMethod;
  path: string;
  headers?: Record<string, string>;
  query?: Record<string, string>;
  body?: unknown;
  /** Override per-request timeout (ms) */
  timeoutMs?: number;
}

export interface HttpResponse<T = unknown> {
  status: number;
  headers: Headers;
  data: T;
}

export class HttpClientError extends Error {
  constructor(
    public readonly clientName: string,
    public readonly status: number,
    public readonly body: string,
    public readonly retryable: boolean
  ) {
    super(`[${clientName}] HTTP ${status}: ${body.slice(0, 300)}`);
    this.name = 'HttpClientError';
  }
}

export class HttpClient {
  private readonly name: string;
  private readonly baseUrl: string;
  private readonly defaultHeaders: Record<string, string>;
  private readonly timeoutMs: number;
  private readonly maxAttempts: number;
  private readonly initialBackoffMs: number;
  private readonly maxBackoffMs: number;

  constructor(opts: HttpClientOptions) {
    this.name = opts.name;
    this.baseUrl = opts.baseUrl.replace(/\/+$/, '');
    this.defaultHeaders = opts.defaultHeaders ?? {};
    this.timeoutMs = opts.timeoutMs ?? 15_000;
    this.maxAttempts = opts.maxAttempts ?? 3;
    this.initialBackoffMs = opts.initialBackoffMs ?? 500;
    this.maxBackoffMs = opts.maxBackoffMs ?? 10_000;
  }

  // ------- public convenience wrappers -------

  get<T = unknown>(path: string, query?: Record<string, string>, headers?: Record<string, string>) {
    return this.request<T>({ method: 'GET', path, query, headers });
  }

  post<T = unknown>(path: string, body?: unknown, headers?: Record<string, string>) {
    return this.request<T>({ method: 'POST', path, body, headers });
  }

  put<T = unknown>(path: string, body?: unknown, headers?: Record<string, string>) {
    return this.request<T>({ method: 'PUT', path, body, headers });
  }

  patch<T = unknown>(path: string, body?: unknown, headers?: Record<string, string>) {
    return this.request<T>({ method: 'PATCH', path, body, headers });
  }

  delete<T = unknown>(path: string, headers?: Record<string, string>) {
    return this.request<T>({ method: 'DELETE', path, headers });
  }

  // ------- core request logic -------

  async request<T = unknown>(opts: HttpRequestOptions): Promise<HttpResponse<T>> {
    const url = this.buildUrl(opts.path, opts.query);
    const method = opts.method ?? 'GET';
    const headers: Record<string, string> = {
      ...this.defaultHeaders,
      ...(opts.headers ?? {})
    };

    if (opts.body && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

    const timeout = opts.timeoutMs ?? this.timeoutMs;
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= this.maxAttempts; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeout);

      try {
        const res = await fetch(url, {
          method,
          headers,
          body: opts.body ? JSON.stringify(opts.body) : undefined,
          signal: controller.signal
        });

        clearTimeout(timer);

        // Rate-limited – honour Retry-After if present
        if (res.status === 429) {
          const retryAfter = parseRetryAfter(res.headers.get('Retry-After'));
          const wait = retryAfter ?? this.backoff(attempt);
          console.warn(`[${this.name}] 429 rate-limited – retry in ${wait}ms (attempt ${attempt}/${this.maxAttempts})`);
          await sleep(wait);
          continue;
        }

        // Server errors are retryable
        if (res.status >= 500) {
          const body = await safeText(res);
          lastError = new HttpClientError(this.name, res.status, body, true);
          console.warn(`[${this.name}] ${res.status} server error – retry in ${this.backoff(attempt)}ms (attempt ${attempt}/${this.maxAttempts})`);
          await sleep(this.backoff(attempt));
          continue;
        }

        // Client errors are NOT retried
        if (res.status >= 400) {
          const body = await safeText(res);
          throw new HttpClientError(this.name, res.status, body, false);
        }

        // 2xx – success
        const data = (await res.json().catch(() => ({}))) as T;
        return { status: res.status, headers: res.headers, data };
      } catch (err: unknown) {
        clearTimeout(timer);

        // Non-retryable client errors should propagate immediately
        if (err instanceof HttpClientError && !err.retryable) {
          throw err;
        }

        // Network / timeout errors
        if (err instanceof DOMException && err.name === 'AbortError') {
          lastError = new Error(`[${this.name}] Request timed out after ${timeout}ms`);
        } else if (!(err instanceof HttpClientError)) {
          lastError = err instanceof Error ? err : new Error(String(err));
        }

        if (attempt < this.maxAttempts) {
          console.warn(`[${this.name}] ${lastError?.message ?? 'Unknown error'} – retry in ${this.backoff(attempt)}ms (attempt ${attempt}/${this.maxAttempts})`);
          await sleep(this.backoff(attempt));
        }
      }
    }

    throw lastError ?? new Error(`[${this.name}] All ${this.maxAttempts} attempts exhausted`);
  }

  // ------- helpers -------

  private buildUrl(path: string, query?: Record<string, string>): string {
    const url = new URL(path.startsWith('http') ? path : `${this.baseUrl}/${path.replace(/^\/+/, '')}`);
    if (query) {
      for (const [k, v] of Object.entries(query)) {
        url.searchParams.set(k, v);
      }
    }
    return url.toString();
  }

  private backoff(attempt: number): number {
    const delay = this.initialBackoffMs * Math.pow(2, attempt - 1);
    // Add 0-25% jitter
    const jitter = delay * Math.random() * 0.25;
    return Math.min(delay + jitter, this.maxBackoffMs);
  }
}

// ------- module-level helpers -------

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function parseRetryAfter(header: string | null): number | null {
  if (!header) return null;
  const seconds = Number(header);
  if (!Number.isNaN(seconds)) return seconds * 1000;
  const date = Date.parse(header);
  if (!Number.isNaN(date)) return Math.max(0, date - Date.now());
  return null;
}

async function safeText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return '';
  }
}
