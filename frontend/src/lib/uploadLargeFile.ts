import { Upload } from 'tus-js-client';
import { supabase, withTimeout } from './supabase';

export function uploadLargeFile(bucket: string, path: string, file: File): Promise<void> {
  const endpoint = new URL(import.meta.env.VITE_SUPABASE_URL);
  if (endpoint.hostname.endsWith('.supabase.co') && !endpoint.hostname.endsWith('.storage.supabase.co')) {
    endpoint.hostname = endpoint.hostname.replace('.supabase.co', '.storage.supabase.co');
  }
  endpoint.pathname = '/storage/v1/upload/resumable';

  return new Promise((resolve, reject) => {
    const upload = new Upload(file, {
      endpoint: endpoint.toString(),
      chunkSize: 6 * 1024 * 1024,
      retryDelays: [0, 3000, 5000, 10000, 20000],
      uploadDataDuringCreation: true,
      storeFingerprintForResuming: false,
      // Refresh credentials for each chunk during long uploads.
      onBeforeRequest: async (request) => {
        const { data: { session }, error } = await withTimeout(supabase.auth.getSession(), 12_000);
        if (error) throw error;
        if (!session) throw new Error('Sessão expirada. Faça login novamente.');
        request.setHeader('Authorization', `Bearer ${session.access_token}`);
      },
      metadata: { bucketName: bucket, objectName: path, contentType: file.type, cacheControl: '3600' },
      onError: reject,
      onSuccess: () => resolve(),
    });
    upload.start();
  });
}
