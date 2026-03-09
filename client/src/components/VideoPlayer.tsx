import React, { useRef, useCallback, useState, useEffect } from 'react';
import type { MediaFile } from '../api';
import { media as mediaApi } from '../api';

type VideoPlayerProps = {
  file: MediaFile;
  src?: string;
  onOpenFullscreen?: () => void;
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
    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
    };
  }, [finalSrc]);

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
      className="video-thumbnail-container"
      style={{ position: 'relative', display: 'inline-block', maxWidth: '100%' }}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      <video
        ref={videoRef}
        // Remove the src from the JSX to prevent auto-loading, 
        // instead we'll load it in the useEffect
        onClick={handleVideoClick}
        controls={false}
        className="video-thumbnail-element"
        style={{ 
          maxWidth: '100%', 
          maxHeight: '300px', 
          borderRadius: '4px', 
          objectFit: 'cover',
          cursor: 'pointer'
        }}
        onLoadedMetadata={handleVideoLoad}
      />
      <div 
        className="video-overlay" 
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: isHovering || !isVideoLoaded ? 1 : 0.2,  // Show when hovering or initially loading
          transition: 'opacity 0.2s ease',
          borderRadius: '4px',
          pointerEvents: 'none'  // Allow clicks to pass through when not hovering over the play button
        }}
      >
        <div 
          className="play-button" 
          style={{
            width: '60px',
            height: '60px',
            borderRadius: '50%',
            background: 'rgba(255,123,0,0.9)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            pointerEvents: 'all'  // Enable interactions with the play button itself
          }}
          onClick={handleVideoClick}
          aria-label="Play video"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polygon points="5 3 19 12 5 21 5 3"></polygon>
          </svg>
        </div>
      </div>
      <div 
        className="video-duration" 
        style={{
          position: 'absolute',
          bottom: '8px',
          right: '8px',
          background: 'rgba(0,0,0,0.7)',
          color: 'white',
          padding: '2px 6px',
          borderRadius: '4px',
          fontSize: '12px',
        }}
      >
        {duration} • {formatSize(file.file_size)}
      </div>
    </div>
  );
};

export default VideoPlayer;