import { getSupabaseServerClient, isSupabaseConfigured } from './supabase-server';

export type UploadKind = 'person_video' | 'person_photo' | 'product_photo';

const bucketByKind: Record<UploadKind, string> = {
  person_video: 'raw_uploads',
  person_photo: 'source_images',
  product_photo: 'product_images'
};

export async function createUploadTicket(kind: UploadKind, fileName: string, userId: string) {
  const cleanFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const objectPath = `${userId}/${Date.now()}-${crypto.randomUUID()}-${cleanFileName}`;

  if (!isSupabaseConfigured()) {
    return {
      mode: 'local-fallback' as const,
      uploadId: crypto.randomUUID(),
      bucket: bucketByKind[kind],
      objectPath
    };
  }

  const client = getSupabaseServerClient();
  if (!client) {
    return {
      mode: 'local-fallback' as const,
      uploadId: crypto.randomUUID(),
      bucket: bucketByKind[kind],
      objectPath
    };
  }

  const bucket = bucketByKind[kind];
  const { data, error } = await client.storage.from(bucket).createSignedUploadUrl(objectPath);

  if (error || !data) {
    return {
      mode: 'local-fallback' as const,
      uploadId: crypto.randomUUID(),
      bucket,
      objectPath
    };
  }

  return {
    mode: 'supabase-signed' as const,
    bucket,
    objectPath,
    token: data.token,
    path: data.path,
    signedUploadPath: `/storage/v1/object/upload/sign/${bucket}/${data.path}`
  };
}
