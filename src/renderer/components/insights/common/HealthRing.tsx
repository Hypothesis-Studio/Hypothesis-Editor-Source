/**
 * HealthRing — Circular progress indicator for health score.
 */
import React from 'react';

interface HealthRingProps {
  score: number;
  size?: number;
  strokeWidth?: number;
}

export const HealthRing: React.FC<HealthRingProps> = ({ score, size = 64, strokeWidth = 6 }) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = score > 70 ? '#10b981' : score > 40 ? '#f59e0b' : '#ef4444';

  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        {/* Background circle */}
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none"
          stroke="var(--theme-bg)"
          strokeWidth={strokeWidth}
        />
        {/* Progress arc */}
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.8s ease' }}
        />
      </svg>
      {/* Center text */}
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: size * 0.28, fontWeight: 700, color,
      }}>
        {score}
      </div>
    </div>
  );
};
