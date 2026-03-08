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
      <button
        type="button"
        className="media-viewer-close"
        onClick={onClose}
        aria-label="Закрыть просмотр медиа"
      >
        ✕
      </button>
      <a
        href={src}
        download={file.original_name}
        className="media-viewer-download-button"
        onClick={(e) => e.stopPropagation()}
        aria-label="Скачать файл"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
          <polyline points="7 10 12 15 17 10"></polyline>
          <line x1="12" y1="15" x2="12" y2="3"></line>
        </svg>
      </a>
      <div className="media-viewer-content">
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

