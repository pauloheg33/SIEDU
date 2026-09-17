import { describe, expect, it } from 'vitest';
import { MAX_EVENT_MEDIA_BYTES, validateEventMedia } from './eventMedia';

describe('event gallery validation', () => {
  it.each(['video/mp4', 'video/quicktime', 'video/webm', 'image/jpeg'])('accepts %s at the limit', (type) => {
    expect(() => validateEventMedia({ name: 'arquivo', type, size: MAX_EVENT_MEDIA_BYTES })).not.toThrow();
  });

  it('rejects a video one byte above 500 MB', () => {
    expect(() => validateEventMedia({ name: 'video.mp4', type: 'video/mp4', size: MAX_EVENT_MEDIA_BYTES + 1 })).toThrow('500 MB');
  });

  it.each(['application/pdf', '', 'application/octet-stream'])('rejects non-media MIME %s', (type) => {
    expect(() => validateEventMedia({ name: 'arquivo.mp4', type, size: 100 })).toThrow('foto ou um vídeo');
  });
});
