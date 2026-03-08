import React, { useRef, useState, useCallback } from 'react';
import type { MediaFile } from '../api';
import { media as mediaApi } from '../api';

type VideoPlayerProps = {
  file: MediaFile;
  src?: string;
  onOpenFullscreen?: () => void;
  showDownloadButton?: boolean;
};

function formatSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '';
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${(bytes / 1024).toFixed(1)} KB`;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({
  file,
  src,
  onOpenFullscreen,
  showDownloadButton = true,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [duration, setDuration] = useState<number | null>(null);

  const finalSrc = src ?? mediaApi.getMediaUrl(file.encrypted_filename);

  const handleLoadedMetadata = useCallback(() => {
    if (videoRef.current && Number.isFinite(videoRef.current.duration)) {
      setDuration(videoRef.current.duration);
    }
  }, []);

  // Toggle fullscreen when clicking the video
  const handleVideoClick = useCallback(() => {
    if (onOpenFullscreen) {
      onOpenFullscreen();
    } else {
      const video = videoRef.current;
      if (!video) return;

      if (video.requestFullscreen) {
        void video.requestFullscreen();
      } else if ((video as any).webkitRequestFullscreen) {
        void (video as any).webkitRequestFullscreen();
      } else if ((video as any).mozRequestFullScreen) {
        void (video as any).mozRequestFullScreen();
      }
    }
  }, [onOpenFullscreen]);

  return (
    <div className="media-player video-player">
      <div className="media-player-video-wrapper">
        <video
          ref={videoRef}
          src={finalSrc}
          onLoadedMetadata={handleLoadedMetadata}
          onClick={handleVideoClick}
          controls={false} // Show native video controls only in fullscreen
          style={{ maxWidth: '100%', maxHeight: '400px', borderRadius: '4px', cursor: 'pointer' }}
        />
      </div>
      <div className="media-player-meta">
        <div className="media-player-title" title={file.original_name}>
          {file.original_name}
        </div>
        <div className="media-player-sub">
          {formatSize(file.file_size) && <span>{formatSize(file.file_size)}</span>}
          {duration != null && (
            <span>
              {formatSize(file.file_size)}
            </span>
          )}
        </div>
        <div className="media-player-actions">
          {showDownloadButton && (
            <a
              href={finalSrc}
              download={file.original_name}
              className="download-button media-download-button"
            >
              Скачать
            </a>
          )}
        </div>
      </div>
    </div>
  );
};

export default VideoPlayer;