import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import ffmpeg from 'fluent-ffmpeg';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { getWorkerSupabaseClient } from '../lib/supabase';
import type { PipelineJobData } from '../types';

ffmpeg.setFfmpegPath(ffmpegInstaller.path);

type AspectRatio = '9:16' | '16:9' | '1:1';

const VARIANT_DIMS: Record<AspectRatio, { w: number; h: number }> = {
  '9:16': { w: 1080, h: 1920 },
  '16:9': { w: 1920, h: 1080 },
  '1:1': { w: 1080, h: 1080 }
};

/** Build an FFmpeg crop+scale filter string for the target aspect ratio. */
function buildVideoFilter(ratio: AspectRatio): string {
  const { w, h } = VARIANT_DIMS[ratio];
  return [
    `crop=min(iw\\,ih*${w}/${h}):min(ih\\,iw*${h}/${w}):(iw-min(iw\\,ih*${w}/${h}))/2:(ih-min(ih\\,iw*${h}/${w}))/2`,
    `scale=${w}:${h}:force_original_aspect_ratio=decrease`,
    `pad=${w}:${h}:(${w}-iw)/2:(${h}-ih)/2`
  ].join(',');
}

function transcodeVariant(inputPath: string, outputPath: string, ratio: AspectRatio): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .videoFilter(buildVideoFilter(ratio))
      .videoCodec('libx264')
      .audioCodec('aac')
      .outputOptions(['-preset', 'fast', '-crf', '23', '-movflags', '+faststart'])
      .on('error', reject)
      .on('end', () => resolve())
      .save(outputPath);
  });
}

/** Download a file from Supabase storage using a signed URL. */
async function downloadFromSupabase(objectPath: string, localPath: string): Promise<boolean> {
  const client = getWorkerSupabaseClient();
  if (!client) return false;

  const [bucket, ...rest] = objectPath.split('/');
  const filePath = rest.join('/');

  const { data, error } = await client.storage.from(bucket).createSignedUrl(filePath, 300);
  if (error || !data?.signedUrl) {
    console.warn(`[VideoProcessing] Signed URL failed for ${objectPath}:`, error?.message);
    return false;
  }

  const response = await fetch(data.signedUrl);
  if (!response.ok) {
    console.warn(`[VideoProcessing] Download failed with status ${response.status}`);
    return false;
  }

  const buffer = await response.arrayBuffer();
  fs.writeFileSync(localPath, Buffer.from(buffer));
  return true;
}

/** Upload a local file to Supabase storage and return the storage path. */
async function uploadToSupabase(localPath: string, storagePath: string): Promise<string | null> {
  const client = getWorkerSupabaseClient();
  if (!client) return null;

  const [bucket, ...rest] = storagePath.split('/');
  const filePath = rest.join('/');
  const fileBuffer = fs.readFileSync(localPath);

  const { error } = await client.storage
    .from(bucket)
    .upload(filePath, fileBuffer, { contentType: 'video/mp4', upsert: true });

  if (error) {
    console.warn(`[VideoProcessing] Upload failed for ${storagePath}:`, error.message);
    return null;
  }

  return storagePath;
}

export async function runVideoProcessing(data: PipelineJobData): Promise<{
  normalizedSourceUrl: string | undefined;
  variants: AspectRatio[];
}> {
  const ratios: AspectRatio[] =
    data.personSourceType === 'video' ? ['9:16', '16:9', '1:1'] : ['9:16'];

  // Photos pass through without transcoding
  if (!data.personSourceUrl || data.personSourceType === 'photo') {
    return { normalizedSourceUrl: data.personSourceUrl, variants: ratios };
  }

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aiad-'));
  const inputPath = path.join(tmpDir, 'input.mp4');

  try {
    const downloaded = await downloadFromSupabase(data.personSourceUrl, inputPath);
    if (!downloaded) {
      return { normalizedSourceUrl: data.personSourceUrl, variants: ratios };
    }

    const uploadedPaths: Partial<Record<AspectRatio, string>> = {};

    for (const ratio of ratios) {
      const safeRatio = ratio.replace(':', 'x');
      const outputPath = path.join(tmpDir, `out_${safeRatio}.mp4`);
      const storagePath = `generated_ads/${data.jobId}/${safeRatio}.mp4`;

      try {
        await transcodeVariant(inputPath, outputPath, ratio);
        const uploaded = await uploadToSupabase(outputPath, storagePath);
        if (uploaded) uploadedPaths[ratio] = uploaded;
      } catch (err) {
        console.warn(`[VideoProcessing] Transcode failed for ${ratio}:`, err);
      } finally {
        if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
      }
    }

    const primaryPath = uploadedPaths['9:16'] ?? Object.values(uploadedPaths)[0];
    return { normalizedSourceUrl: primaryPath ?? data.personSourceUrl, variants: ratios };
  } finally {
    if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
    try { fs.rmdirSync(tmpDir); } catch { /* non-empty dir — ignore */ }
  }
}
