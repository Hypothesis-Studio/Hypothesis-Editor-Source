/**
 * Video Preview — Full video player with transport controls.
 */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { PreviewData } from '../../../shared/types/preview';
import { Icon } from '../common/Icon';

interface VideoPreviewProps {
  data: PreviewData;
}

export const VideoPreview: React.FC<VideoPreviewProps> = ({ data }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const controlsTimer = useRef<ReturnType<typeof setTimeout>>();

  const src = data.dataUrl || `file:///${data.filePath.replace(/\\/g, '/')}`;

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onTimeUpdate = () => setCurrentTime(video.currentTime);
    const onLoadedMetadata = () => setDuration(video.duration);
    const onEnded = () => setIsPlaying(false);
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);

    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('loadedmetadata', onLoadedMetadata);
    video.addEventListener('ended', onEnded);
    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);

    return () => {
      video.removeEventListener('timeupdate', onTimeUpdate);
      video.removeEventListener('loadedmetadata', onLoadedMetadata);
      video.removeEventListener('ended', onEnded);
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
    };
  }, [src]);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (isPlaying) {
      video.pause();
    } else {
      video.play().catch(() => {});
    }
  }, [isPlaying]);

  const handleSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (videoRef.current) {
      videoRef.current.currentTime = time;
    }
    setCurrentTime(time);
  }, []);

  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const vol = parseFloat(e.target.value);
    setVolume(vol);
    setIsMuted(vol === 0);
    if (videoRef.current) {
      videoRef.current.volume = vol;
    }
  }, []);

  const toggleMute = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
    }
    setIsMuted(!isMuted);
  }, [isMuted]);

  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  }, []);

  const handleMouseMove = useCallback(() => {
    setShowControls(true);
    if (controlsTimer.current) clearTimeout(controlsTimer.current);
    controlsTimer.current = setTimeout(() => {
      if (isPlaying) setShowControls(false);
    }, 3000);
  }, [isPlaying]);

  const skip = useCallback((seconds: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = Math.max(0, Math.min(duration, videoRef.current.currentTime + seconds));
    }
  }, [duration]);

  return (
    <div
      ref={containerRef}
      style={{ position: 'relative', width: '100%', height: '100%', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => isPlaying && setShowControls(false)}
    >
      <video
        ref={videoRef}
        src={src}
        style={{ maxWidth: '100%', maxHeight: '100%', cursor: 'pointer' }}
        onClick={togglePlay}
        playsInline
      />

      {/* Play overlay (when paused) */}
      {!isPlaying && (
        <div
          style={{
            position: 'absolute', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.3)', cursor: 'pointer',
          }}
          onClick={togglePlay}
        >
          <div style={{
            width: 64, height: 64, borderRadius: '50%',
            background: 'rgba(0,0,0,0.6)', border: '2px solid rgba(255,255,255,0.8)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon name="play" size={28} style={{ color: '#fff', marginLeft: 4 }} />
          </div>
        </div>
      )}

      {/* Controls bar */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        background: 'linear-gradient(transparent, rgba(0,0,0,0.8))',
        padding: '24px 12px 12px',
        opacity: showControls ? 1 : 0,
        transition: 'opacity 0.3s',
        pointerEvents: showControls ? 'auto' : 'none',
      }}>
        {/* Progress bar */}
        <input
          type="range"
          min={0}
          max={duration || 0}
          step={0.1}
          value={currentTime}
          onChange={handleSeek}
          style={{
            width: '100%', height: 4,
            appearance: 'none', WebkitAppearance: 'none',
            background: `linear-gradient(to right, var(--theme-accent) ${(currentTime / (duration || 1)) * 100}%, rgba(255,255,255,0.3) ${(currentTime / (duration || 1)) * 100}%)`,
            borderRadius: 2, outline: 'none', cursor: 'pointer', marginBottom: 8,
          }}
        />

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Play/Pause */}
          <button onClick={togglePlay} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#fff', padding: 4 }}>
            <Icon name={isPlaying ? 'debug-pause' : 'play'} size={18} />
          </button>

          {/* Skip buttons */}
          <button onClick={() => skip(-10)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#fff', padding: 4 }}>
            <Icon name="run" size={14} />
          </button>
          <button onClick={() => skip(10)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#fff', padding: 4 }}>
            <Icon name="run" size={14} />
          </button>

          {/* Time */}
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)', fontFamily: 'monospace', minWidth: 90 }}>
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>

          <div style={{ flex: 1 }} />

          {/* Volume */}
          <button onClick={toggleMute} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#fff', padding: 4 }}>
            <Icon name={isMuted || volume === 0 ? 'mute' : 'unmute'} size={16} />
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={isMuted ? 0 : volume}
            onChange={handleVolumeChange}
            style={{
              width: 70, height: 3,
              appearance: 'none', WebkitAppearance: 'none',
              background: `linear-gradient(to right, #fff ${(isMuted ? 0 : volume) * 100}%, rgba(255,255,255,0.3) ${(isMuted ? 0 : volume) * 100}%)`,
              borderRadius: 2, outline: 'none', cursor: 'pointer',
            }}
          />

          {/* Fullscreen */}
          <button onClick={toggleFullscreen} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#fff', padding: 4 }}>
            <Icon name={isFullscreen ? 'screen-normal' : 'screen-full'} size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};

function formatTime(seconds: number): string {
  if (!isFinite(seconds)) return '0:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
