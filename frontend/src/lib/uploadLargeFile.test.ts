import { afterEach, describe, expect, it, vi } from 'vitest';
import type { UploadOptions } from 'tus-js-client';

const mocks = vi.hoisted(() => ({ options: {} as UploadOptions, getSession: vi.fn() }));
vi.mock('tus-js-client', () => ({
  Upload: class {
    constructor(_file: File, options: UploadOptions) { mocks.options = options; }
    start() {}
  },
}));
vi.mock('./supabase', () => ({
  supabase: { auth: { getSession: mocks.getSession } },
  withTimeout: (promise: Promise<unknown>) => promise,
}));
import { uploadLargeFile } from './uploadLargeFile';

afterEach(() => vi.unstubAllEnvs());

describe('chunked media upload', () => {
  it('sends 6 MiB chunks to the correct bucket and resolves only on success', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
    const pending = uploadLargeFile('photos', 'event/video.mp4', new File(['video'], 'video.mp4', { type: 'video/mp4' }));
    expect(mocks.options.endpoint).toBe('https://example.storage.supabase.co/storage/v1/upload/resumable');
    expect(mocks.options.chunkSize).toBe(6 * 1024 * 1024);
    expect(mocks.options.metadata).toMatchObject({ bucketName: 'photos', objectName: 'event/video.mp4', contentType: 'video/mp4' });
    mocks.options.onSuccess!({} as never);
    await expect(pending).resolves.toBeUndefined();
  });

  it('propagates upload failures', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'http://localhost:54321');
    const pending = uploadLargeFile('photos', 'event/video.mp4', new File([], 'video.mp4'));
    expect(mocks.options.endpoint).toBe('http://localhost:54321/storage/v1/upload/resumable');
    mocks.options.onError!(new Error('Upload failed'));
    await expect(pending).rejects.toThrow('Upload failed');
  });
});
