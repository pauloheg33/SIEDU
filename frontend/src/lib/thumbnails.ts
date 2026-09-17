// Stored alongside the original, under the same event storage permissions.
export function thumbnailPath(eventId: string, fileId: string): string {
  return `${eventId}/thumb-${fileId}.jpg`;
}

export function createThumbnail(source: CanvasImageSource, width: number, height: number): Promise<Blob> {
  const scale = Math.min(1, 384 / Math.max(width, height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const context = canvas.getContext('2d');
  if (!context) return Promise.reject(new Error('Canvas indisponível'));
  context.fillStyle = '#fff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(source, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) => canvas.toBlob(
    (blob) => blob ? resolve(blob) : reject(new Error('Falha ao gerar miniatura')),
    'image/jpeg', 0.75,
  ));
}
