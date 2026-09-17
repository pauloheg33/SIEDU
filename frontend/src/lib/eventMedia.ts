export const MAX_EVENT_MEDIA_BYTES = 500 * 1024 * 1024;

export function validateEventMedia(file: Pick<File, 'name' | 'type' | 'size'>): void {
  if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
    throw new Error(`${file.name}: selecione uma foto ou um vídeo.`);
  }
  if (file.size > MAX_EVENT_MEDIA_BYTES) {
    throw new Error(`${file.name}: o limite é de 500 MB por arquivo.`);
  }
}
