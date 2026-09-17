import { describe, expect, it, vi } from 'vitest';
import { FileKind } from '@/types';

const mocks = vi.hoisted(() => ({ rows: [] as unknown[], sign: vi.fn() }));
vi.mock('./supabase', () => ({
  ensureFreshSession: vi.fn(), getAuthenticatedUser: vi.fn(), querySignal: vi.fn(),
  withTimeout: (operation: unknown) => operation,
  supabase: {
    from: () => {
      const query = { select: () => query, abortSignal: () => query, eq: () => query,
        order: () => query, then: (resolve: (value: unknown) => unknown) =>
          Promise.resolve({ data: mocks.rows, error: null }).then(resolve) };
      return query;
    },
    storage: { from: () => ({ createSignedUrls: mocks.sign }) },
  },
}));
vi.mock('./uploadLargeFile', () => ({ uploadLargeFile: vi.fn() }));
import { filesAPI } from './api';

describe('private thumbnail URLs', () => {
  it('signs thumbnails and originals in one batch without replacing thumbnails with originals', async () => {
    mocks.rows = [{ id: 'a', kind: 'PHOTO', storage_path: 'event/original.jpg',
      url: 'https://storage.test/storage/v1/object/public/photos/event/original.jpg',
      thumbnail_url: 'https://storage.test/storage/v1/object/public/photos/event/thumb-a.jpg' }];
    mocks.sign.mockResolvedValue({ data: [{ signedUrl: 'original-signed' }, { signedUrl: 'small-signed' }] });
    const [file] = await filesAPI.list('event', FileKind.PHOTO);
    expect(mocks.sign).toHaveBeenLastCalledWith(['event/original.jpg', 'event/thumb-a.jpg'], 3600);
    expect(file.url).toBe('original-signed');
    expect(file.thumbnail_url).toBe('small-signed');
  });

  it('keeps the original available when a thumbnail has been removed from storage', async () => {
    mocks.rows = [{ id: 'a', kind: 'PHOTO', storage_path: 'event/original.jpg',
      url: 'https://storage.test/storage/v1/object/public/photos/event/original.jpg',
      thumbnail_url: 'https://storage.test/storage/v1/object/public/photos/event/thumb-a.jpg' }];
    mocks.sign.mockResolvedValue({ data: [{ signedUrl: 'original-signed' }, { error: 'missing' }] });
    const [file] = await filesAPI.list('event', FileKind.PHOTO);
    expect(file.thumbnail_url).toBe(file.url);
  });
});
