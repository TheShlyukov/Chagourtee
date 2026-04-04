import React, { useRef, useCallback, useState, useEffect } from 'react';
import type { MediaFile } from '../api';
import { media as mediaApi } from '../api';

type VideoPlayerProps = {
  file: MediaFile;
  src?: string;
  onOpenFullscreen?: () => void;
  onError?: () => void;
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
  onError,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [duration, setDuration] = useState<string>('0:00');
  const [isHovering, setIsHovering] = useState(false);
  const [isVideoLoaded, setIsVideoLoaded] = useState(false);

  const finalSrc = src ?? mediaApi.getMediaUrl(file.encrypted_filename);

  // Get video duration when metadata loads
  useEffect(() => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    // Append a timestamp to the URL to bypass cache in Safari
    const tempSrc = `${finalSrc}?t=${Date.now()}`;
    video.src = tempSrc;
    
    const handleLoadedMetadata = () => {
      const minutes = Math.floor(video.duration / 60);
      const seconds = Math.floor(video.duration % 60);
      setDuration(`${minutes}:${seconds.toString().padStart(2, '0')}`);
    };
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    const handleError = () => {
      onError?.();
    };
    video.addEventListener('error', handleError);
    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('error', handleError);
    };
  }, [finalSrc, onError]);

  // Handle video loaded event and force load in Safari
  const handleVideoLoad = () => {
    setIsVideoLoaded(true);
  };

  // Effect to load the video element properly in Safari
  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      // Detect Safari browser
      const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
      
      if (isSafari) {
        // For Safari, reload the video source to ensure proper loading
        const loadVideo = () => {
          // Set the source again to force a reload
          video.src = finalSrc;
          video.load();
        };
        
        // Load immediately and add event listeners
        loadVideo();
        
        // Add a timeout to ensure the video loads properly in Safari
        const timer = setTimeout(() => {
          if (video.networkState === HTMLMediaElement.NETWORK_EMPTY) {
            loadVideo();
          }
        }, 100);
        
        return () => clearTimeout(timer);
      } else {
        // For non-Safari browsers, just set the source
        video.src = finalSrc;
        video.load();
      }
    }
  }, [finalSrc]);

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
    <div
      className="video-thumbnail-container video-player-root"
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      <video
        ref={videoRef}
        onClick={handleVideoClick}
        controls={false}
        className="video-thumbnail-element video-player-video"
        onLoadedMetadata={handleVideoLoad}
        onError={onError}
      />
      <div
        className={`video-overlay video-player-overlay${
          isHovering || !isVideoLoaded ? ' video-player-overlay--show' : ' video-player-overlay--dim'
        }`}
      >
        <button
          type="button"
          className="play-button video-player-play"
          onClick={handleVideoClick}
          aria-label="Play video"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polygon points="5 3 19 12 5 21 5 3"></polygon>
          </svg>
        </button>
      </div>
      <div className="video-duration video-player-badge">
        {duration} • {formatSize(file.file_size)}
      </div>
    </div>
  );
};

export default VideoPlayer;