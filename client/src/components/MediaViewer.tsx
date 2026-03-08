import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { MediaFile } from '../api';
import { media as mediaApi } from '../api';

type MediaViewerProps = {
  file: MediaFile;
  mode: 'image' | 'video';
  onClose: () => void;
};

const MediaViewer: React.FC<MediaViewerProps> = ({ file, mode, onClose }) => {
  const src = mediaApi.getMediaUrl(file.encrypted_filename);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  const handleOverlayClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      onClose();
    }
  };

  const content = (
    <div className="media-viewer-overlay" onClick={handleOverlayClick}>
      <div className="media-viewer-content">
        <button
          type="button"
          className="media-viewer-close"
          onClick={onClose}
          aria-label="Закрыть просмотр медиа"
        >
          ✕
        </button>
        {mode === 'image' ? (
          <img
            src={src}
            alt={file.original_name}
            className="media-viewer-image"
          />
        ) : (
          <video
            src={src}
            className="media-viewer-video"
            controls
            autoPlay
          />
        )}
        <div className="media-viewer-caption" title={file.original_name}>
          {file.original_name}
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
};

export default MediaViewer;

