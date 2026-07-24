/**
 * SectionHeader — Reusable section header with optional action button.
 */
import React from 'react';
import { Icon } from '../../common/Icon';

interface SectionHeaderProps {
  icon: string;
  title: string;
  subtitle?: string;
  action?: { label: string; icon?: string; onClick: () => void };
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({ icon, title, subtitle, action }) => {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Icon name={icon} size={16} style={{ color: 'var(--theme-accent)' }} />
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--theme-fg)' }}>{title}</div>
          {subtitle && <div style={{ fontSize: 11, color: 'var(--theme-fg-muted)', marginTop: 2 }}>{subtitle}</div>}
        </div>
      </div>
      {action && (
        <button
          onClick={action.onClick}
          style={{
            display: 'flex', alignItems: 'center', gap: 4,
            padding: '4px 10px', fontSize: 11, fontWeight: 500,
            color: '#fff', background: 'var(--theme-accent)',
            border: 'none', borderRadius: 4, cursor: 'pointer',
          }}
        >
          {action.icon && <Icon name={action.icon} size={12} />}
          {action.label}
        </button>
      )}
    </div>
  );
};
