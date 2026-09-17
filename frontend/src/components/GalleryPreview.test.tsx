import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import GalleryPreview from './GalleryPreview';
import { filesAPI } from '@/lib/api';
import type { EventFile } from '@/types';

vi.mock('@/lib/api', () => ({ filesAPI: { saveThumbnail: vi.fn().mockResolvedValue(undefined) } }));
vi.mock('@/lib/thumbnails', () => ({ createThumbnail: vi.fn().mockResolvedValue(new Blob(['small'])) }));
const file = { id: '1', mime: 'image/jpeg', filename: 'Foto.jpg', url: 'https://example.com/original',
  thumbnail_url: 'https://example.com/small' } as EventFile;

describe('gallery previews', () => {
  beforeEach(() => vi.clearAllMocks());

  it('loads the small image and opens the original only on user request', () => {
    const onOpen = vi.fn();
    render(<GalleryPreview file={file} onOpen={onOpen} />);
    expect(screen.getByRole('img')).toHaveAttribute('src', file.thumbnail_url);
    expect(onOpen).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button'));
    expect(onOpen).toHaveBeenCalledOnce();
  });

  it('falls back once, then displays the filename if the original also fails', () => {
    render(<GalleryPreview file={file} onOpen={vi.fn()} />);
    fireEvent.error(screen.getByRole('img'));
    expect(screen.getByRole('img')).toHaveAttribute('src', file.url);
    fireEvent.error(screen.getByRole('img'));
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.getByText(file.filename)).toBeInTheDocument();
  });

  it('does not create a video player or fetch video metadata in the grid', () => {
    const { container } = render(<GalleryPreview file={{ ...file, mime: 'video/mp4' }} onOpen={vi.fn()} />);
    expect(container.querySelector('video')).toBeNull();
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('backfills a legacy image after loading, only with editing access', async () => {
    render(<GalleryPreview file={{ ...file, thumbnail_url: file.url }} canSaveThumbnail onOpen={vi.fn()} />);
    fireEvent.load(screen.getByRole('img'));
    await waitFor(() => expect(filesAPI.saveThumbnail).toHaveBeenCalledOnce());
  });

  it('never writes thumbnails from the public gallery', () => {
    render(<GalleryPreview file={{ ...file, thumbnail_url: file.url }} onOpen={vi.fn()} />);
    fireEvent.load(screen.getByRole('img'));
    expect(filesAPI.saveThumbnail).not.toHaveBeenCalled();
  });
});
