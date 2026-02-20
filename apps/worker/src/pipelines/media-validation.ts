import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createWriteStream, promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import type { PipelineJobData } from '../types';

const execFileAsync = promisify(execFile);

// ─── Limits ────────────────────────────────────────────────────────────────────
const MAX_VIDEO_BYTES = 500 * 1024 * 1024;  // 500 MB
const MAX_IMAGE_BYTES = 20 * 1024 * 1024;   // 20 MB
const MAX_VIDEO_DURATION_S = 600;           // 10 minutes
const ALLOWED_VIDEO_MIME = new Set([
  'video/mp4', 'video/quicktime', 'video/webm', 'video/x-msvideo', 'video/mpeg'
]);
const ALLOWED_IMAGE_MIME = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/gif'
]);

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function fetchHead(url: string): Promise<{ contentType: string; contentLength: number }> {
  const res = await fetch(url, { method: 'HEAD' });
  if (!res.ok) throw new Error(`HEAD request failed: ${res.status} ${res.statusText}`);
  return {
    contentType: (res.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase(),
    contentLength: Number(res.headers.get('content-length') ?? -1)
  };
}

async function downloadToTemp(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);
  const ext = url.split('?')[0].split('.').pop() ?? 'bin';
  const dest = join(tmpdir(), `mv-${Date.now()}.${ext}`);
  const body = res.body;
  if (!body) throw new Error('Empty response body');

  const out = createWriteStream(dest);
  await new Promise<void>((resolve, reject) => {
    Readable.fromWeb(body as Parameters<typeof Readable.fromWeb>[0]).pipe(out)
      .on('finish', resolve)
      .on('error', reject);
  });
  return dest;
}

async function getVideoDuration(filePath: string): Promise<number> {
  try {
    const { stdout } = await execFileAsync('ffprobe', [
      '-v', 'quiet',
      '-print_format', 'json',
      '-show_streams',
      '-select_streams', 'v:0',
      filePath
    ]);
    const parsed = JSON.parse(stdout) as { streams?: { duration?: string }[] };
    const dur = parsed.streams?.[0]?.duration;
    return dur ? parseFloat(dur) : 0;
  } catch {
    // ffprobe not available gracefully
    return 0;
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export type MediaValidationResult = {
  valid: true;
  contentType: string;
  fileSizeBytes: number;
  durationSeconds?: number;
} | {
  valid: false;
  reason: string;
};

export async function runMediaValidation(data: PipelineJobData): Promise<MediaValidationResult> {
  const { personSourceUrl, personSourceType } = data;

  if (!personSourceUrl) {
    return { valid: false, reason: 'No person source URL provided.' };
  }

  // ── Step 1: HEAD request ───────────────────────────────────────────────────
  let meta: { contentType: string; contentLength: number };
  try {
    meta = await fetchHead(personSourceUrl);
  } catch (err: unknown) {
    return { valid: false, reason: `Could not reach media URL: ${(err as Error).message}` };
  }

  const isVideo = personSourceType === 'video';
  const allowedMimes = isVideo ? ALLOWED_VIDEO_MIME : ALLOWED_IMAGE_MIME;
  const maxBytes = isVideo ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;

  if (!allowedMimes.has(meta.contentType)) {
    return {
      valid: false,
      reason: `Unsupported media type "${meta.contentType}". Accepted: ${[...allowedMimes].join(', ')}`
    };
  }

  if (meta.contentLength > 0 && meta.contentLength > maxBytes) {
    const mb = (meta.contentLength / 1024 / 1024).toFixed(1);
    const maxMb = (maxBytes / 1024 / 1024).toFixed(0);
    return { valid: false, reason: `File too large: ${mb} MB (max ${maxMb} MB).` };
  }

  // ── Step 2: Download for duration check if video ───────────────────────────
  let durationSeconds: number | undefined;
  if (isVideo) {
    let tmpPath: string | undefined;
    try {
      tmpPath = await downloadToTemp(personSourceUrl);
      const stat = await fs.stat(tmpPath);
      if (stat.size > maxBytes) {
        const mb = (stat.size / 1024 / 1024).toFixed(1);
        return { valid: false, reason: `Downloaded file too large: ${mb} MB.` };
      }
      durationSeconds = await getVideoDuration(tmpPath);
      if (durationSeconds > MAX_VIDEO_DURATION_S) {
        return {
          valid: false,
          reason: `Video too long: ${Math.round(durationSeconds)}s (max ${MAX_VIDEO_DURATION_S}s).`
        };
      }
    } finally {
      if (tmpPath) await fs.unlink(tmpPath).catch(() => null);
    }
  }

  return {
    valid: true,
    contentType: meta.contentType,
    fileSizeBytes: meta.contentLength,
    durationSeconds
  };
}
