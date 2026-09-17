import { useState } from 'react';
import { ImageOff, Play } from 'lucide-react';
import type { EventFile } from '@/types';
import { filesAPI } from '@/lib/api';
import { createThumbnail } from '@/lib/thumbnails';
import './GalleryPreview.css';

export default function GalleryPreview({ file, onOpen, canSaveThumbnail = false }: {
  file: EventFile;
  onOpen: () => void;
  canSaveThumbnail?: boolean;
}) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [useOriginal, setUseOriginal] = useState(false);
  const video = file.mime.startsWith('video/');
  return <button type="button" className={`gallery-preview ${loaded ? 'is-loaded' : ''}`}
    onClick={onOpen} aria-label={`Abrir ${file.filename}`}>
    {video ? <span className="gallery-video"><Play size={36} /><span>{file.filename}</span></span>
      : failed ? <span className="gallery-video"><ImageOff size={28} /><span>{file.filename}</span></span>
        : <>
          {!loaded && <span className="gallery-placeholder" aria-hidden="true" />}
          <img src={useOriginal ? file.url : file.thumbnail_url || file.url} alt={file.filename}
            crossOrigin="anonymous" loading="lazy" decoding="async" width={384} height={384}
            onLoad={(event) => {
              setLoaded(true);
              if (canSaveThumbnail && (!file.thumbnail_url || file.thumbnail_url === file.url || useOriginal)) {
                const image = event.currentTarget;
                try {
                  void createThumbnail(image, image.naturalWidth, image.naturalHeight)
                    .then((blob) => filesAPI.saveThumbnail(file, blob)).catch(() => {});
                } catch { /* Preview still works if this browser cannot resize the image. */ }
              }
            }}
            onError={() => {
              if (!useOriginal && file.thumbnail_url && file.thumbnail_url !== file.url) setUseOriginal(true);
              else setFailed(true);
            }} />
        </>}
  </button>;
}
