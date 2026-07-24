/**
 * MetricCard — Compact metric display with icon and color accent.
 */
import React from 'react';
import { Icon } from '../../common/Icon';

interface MetricCardProps {
  label: string;
  value: string;
  icon: string;
  color: string;
  subtitle?: string;
  onClick?: () => void;
}

export const MetricCard: React.FC<MetricCardProps> = ({ label, value, icon, color, subtitle, onClick }) => {
  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '12px 14px', borderRadius: 8,
        background: 'var(--theme-bg-secondary)',
        border: '1px solid var(--theme-border)',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'border-color 0.15s',
      }}
      onMouseEnter={(e) => { if (onClick) e.currentTarget.style.borderColor = color; }}
      onMouseLeave={(e) => { if (onClick) e.currentTarget.style.borderColor = 'var(--theme-border)'; }}
    >
      <div style={{
        width: 36, height: 36, borderRadius: 8,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: `${color}15`,
      }}>
        <Icon name={icon} size={18} style={{ color }} />
      </div>
      <div>
        <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--theme-fg)', lineHeight: 1.2 }}>{value}</div>
        <div style={{ fontSize: 11, color: 'var(--theme-fg-muted)' }}>{label}</div>
        {subtitle && <div style={{ fontSize: 10, color: 'var(--theme-fg-muted)', opacity: 0.7 }}>{subtitle}</div>}
      </div>
    </div>
  );
};
