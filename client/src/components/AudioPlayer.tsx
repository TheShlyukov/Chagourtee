import React, { useRef, useState, useCallback } from 'react';
import type { MediaFile } from '../api';
import { media as mediaApi } from '../api';

type AudioPlayerProps = {
  file: MediaFile;
  src?: string;
  onOpenFullscreen?: () => void;
  showDownloadButton?: boolean;
};

function formatTime(seconds: number | null): string {
  if (seconds == null || !Number.isFinite(seconds)) return '--:--';
  const total = Math.floor(seconds);
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  const mm = mins.toString().padStart(2, '0');
  const ss = secs.toString().padStart(2, '0');
  return `${mm}:${ss}`;
}

function formatSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '';
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${(bytes / 1024).toFixed(1)} KB`;
}

const AudioPlayer: React.FC<AudioPlayerProps> = ({ file, src, showDownloadButton = true }) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [duration, setDuration] = useState<number | null>(null);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const finalSrc = src ?? mediaApi.getMediaUrl(file.encrypted_filename);

  const handleLoadedMetadata = useCallback(() => {
    if (audioRef.current && Number.isFinite(audioRef.current.duration)) {
      setDuration(audioRef.current.duration);
    }
  }, []);

  const handleTimeUpdate = useCallback(() => {
    if (audioRef.current && Number.isFinite(audioRef.current.currentTime)) {
      setCurrentTime(audioRef.current.currentTime);
    }
  }, []);

  const handleSeek = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (!audioRef.current || duration == null || duration <= 0) return;
      const rect = event.currentTarget.getBoundingClientRect();
      const ratio = (event.clientX - rect.left) / rect.width;
      const clampedRatio = Math.max(0, Math.min(1, ratio));
      const newTime = clampedRatio * duration;
      audioRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    },
    [duration]
  );

  const updateMediaSession = useCallback(() => {
    const anyNavigator = navigator as any;
    const anyWindow = window as any;

    try {
      if (anyNavigator.mediaSession && typeof anyWindow.MediaMetadata === 'function') {
        anyNavigator.mediaSession.metadata = new anyWindow.MediaMetadata({
          title: file.original_name,
        });

        // Add seek handler for OS media controls
        if ('setActionHandler' in anyNavigator.mediaSession) {
          anyNavigator.mediaSession.setActionHandler('seekto', (details: { seekTime: number }) => {
            if (audioRef.current && duration != null && duration > 0) {
              audioRef.current.currentTime = details.seekTime;
              setCurrentTime(details.seekTime);
            }
          });
        }
      }
    } catch {
      // Ignore Media Session errors in unsupported environments
    }
  }, [file.original_name, duration]);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (audio.paused) {
      void audio.play();
    } else {
      audio.pause();
    }
  }, []);

  const handlePlay = useCallback(() => {
    setIsPlaying(true);
    updateMediaSession();
  }, [updateMediaSession]);

  const handlePause = useCallback(() => {
    setIsPlaying(false);
  }, []);

  const progressPercent =
    duration && duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;

  return (
    <div className="media-player audio-player">
      <audio
        ref={audioRef}
        src={finalSrc}
        onLoadedMetadata={handleLoadedMetadata}
        onTimeUpdate={handleTimeUpdate}
        onPlay={handlePlay}
        onPause={handlePause}
        style={{ display: 'none' }}
      />
      <div className="media-player-controls">
        <button
          type="button"
          className="media-play-button"
          onClick={togglePlay}
          aria-label={isPlaying ? 'Пауза' : 'Воспроизвести'}
        >
          {isPlaying ? '❚❚' : '▶'}
        </button>
        <div className="media-progress" onClick={handleSeek}>
          <div className="media-progress-bar">
            <div
              className="media-progress-fill"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
        <div className="media-time">
          {formatTime(currentTime)} / {formatTime(duration)}
        </div>
      </div>
      <div className="media-player-meta">
        <div className="media-player-title" title={file.original_name}>
          {file.original_name}
        </div>
        <div className="media-player-sub">
          {formatSize(file.file_size) && <span>{formatSize(file.file_size)}</span>}
        </div>
        {showDownloadButton && (
          <div className="media-player-actions">
            <a
              href={finalSrc}
              download={file.original_name}
              className="download-button media-download-button"
            >
              Скачать
            </a>
          </div>
        )}
      </div>
    </div>
  );
};

export default AudioPlayer;

