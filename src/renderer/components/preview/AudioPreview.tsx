/**
 * Audio Preview — Full audio player with transport controls.
 */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { PreviewData } from '../../../shared/types/preview';
import { Icon } from '../common/Icon';

interface AudioPreviewProps {
  data: PreviewData;
}

export const AudioPreview: React.FC<AudioPreviewProps> = ({ data }) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  const src = data.dataUrl || `file:///${data.filePath.replace(/\\/g, '/')}`;

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onLoadedMetadata = () => {
      setDuration(audio.duration);
      setIsLoaded(true);
    };
    const onEnded = () => setIsPlaying(false);
    const onError = () => setIsLoaded(false);

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
    };
  }, [src]);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
    } else {
      audio.play().catch(() => {});
    }
    setIsPlaying(!isPlaying);
  }, [isPlaying]);

  const handleSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
    }
    setCurrentTime(time);
  }, []);

  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const vol = parseFloat(e.target.value);
    setVolume(vol);
    setIsMuted(vol === 0);
    if (audioRef.current) {
      audioRef.current.volume = vol;
    }
  }, []);

  const toggleMute = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.muted = !isMuted;
    }
    setIsMuted(!isMuted);
  }, [isMuted]);

  const skip = useCallback((seconds: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = Math.max(0, Math.min(duration, audioRef.current.currentTime + seconds));
    }
  }, [duration]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 24, padding: 32 }}>
      <audio ref={audioRef} src={src} preload="metadata" />

      {/* Album art placeholder */}
      <div style={{
        width: 200, height: 200, borderRadius: 12,
        background: 'var(--theme-bg-secondary)',
        border: '1px solid var(--theme-border)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon name="file-media" size={64} style={{ color: 'var(--theme-fg-muted)', opacity: 0.3 }} />
      </div>

      {/* File info */}
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--theme-fg)', marginBottom: 4 }}>{data.fileName}</div>
        <div style={{ fontSize: 11, color: 'var(--theme-fg-muted)' }}>{formatFileSize(data.fileSize)}</div>
      </div>

      {/* Progress bar */}
      <div style={{ width: '100%', maxWidth: 400 }}>
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
            background: `linear-gradient(to right, var(--theme-accent) ${(currentTime / (duration || 1)) * 100}%, var(--theme-bg-secondary) ${(currentTime / (duration || 1)) * 100}%)`,
            borderRadius: 2, outline: 'none', cursor: 'pointer',
          }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--theme-fg-muted)', marginTop: 4 }}>
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* Transport controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <TransportButton icon="run" onClick={() => skip(-10)} title="Back 10s" size={16} />
        <button
          onClick={togglePlay}
          style={{
            width: 48, height: 48, borderRadius: '50%',
            background: 'var(--theme-accent)', border: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: '#fff',
          }}
        >
          <Icon name={isPlaying ? 'debug-pause' : 'play'} size={20} />
        </button>
        <TransportButton icon="run" onClick={() => skip(10)} title="Forward 10s" size={16} />
      </div>

      {/* Volume */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button onClick={toggleMute} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--theme-fg-muted)', padding: 4 }}>
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
            width: 100, height: 3,
            appearance: 'none', WebkitAppearance: 'none',
            background: `linear-gradient(to right, var(--theme-accent) ${(isMuted ? 0 : volume) * 100}%, var(--theme-bg-secondary) ${(isMuted ? 0 : volume) * 100}%)`,
            borderRadius: 2, outline: 'none', cursor: 'pointer',
          }}
        />
      </div>
    </div>
  );
};

const TransportButton: React.FC<{ icon: string; onClick: () => void; title: string; size: number }> = ({ icon, onClick, title, size }) => (
  <button
    onClick={onClick}
    title={title}
    style={{
      width: 36, height: 36, borderRadius: '50%',
      background: 'var(--theme-bg-secondary)', border: '1px solid var(--theme-border)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      cursor: 'pointer', color: 'var(--theme-fg-muted)',
    }}
  >
    <Icon name={icon} size={size} />
  </button>
);

function formatTime(seconds: number): string {
  if (!isFinite(seconds)) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(i > 0 ? 1 : 0)} ${sizes[i]}`;
}
