/**
 * REST Client - Environment Manager
 */
import React, { useState } from 'react';
import type { RestClientEnvironment, RestClientVariable } from '../../../shared/types/rest-client';
import { Icon } from '../common/Icon';
import { ModalShell, modalStyles as S } from '../common/ModalShell';
import { useRestClientStore } from '../../stores/restClientStore';

export const EnvironmentManager: React.FC = () => {
  const {
    environments, activeEnvironmentId,
    createEnvironment, updateEnvironment, deleteEnvironment,
    activateEnvironment, deactivateEnvironment, duplicateEnvironment,
    setShowEnvironmentManager,
  } = useRestClientStore();
  const [selId, setSelId] = useState<string | null>(activeEnvironmentId);
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const sel = environments.find(e => e.id === selId);

  const handleCreate = () => {
    if (!newName.trim()) return;
    createEnvironment(newName.trim()); setNewName(''); setIsCreating(false);
  };
  const handleAddVar = () => {
    if (!sel) return;
    updateEnvironment(sel.id, { variables: [...sel.variables, { key: '', value: '', enabled: true, scope: 'environment' }] });
  };
  const handleUpdateVar = (i: number, f: 'key' | 'value', v: string) => {
    if (!sel) return;
    const vars = [...sel.variables]; vars[i] = { ...vars[i], [f]: v };
    updateEnvironment(sel.id, { variables: vars });
  };
  const handleToggleVar = (i: number) => {
    if (!sel) return;
    const vars = [...sel.variables]; vars[i] = { ...vars[i], enabled: !vars[i].enabled };
    updateEnvironment(sel.id, { variables: vars });
  };
  const handleDelVar = (i: number) => {
    if (!sel) return;
    updateEnvironment(sel.id, { variables: sel.variables.filter((_, j) => j !== i) });
  };

  return (
    <ModalShell
      title="Environment Manager"
      icon="symbol-variable"
      width={800}
      maxHeight="80vh"
      onClose={() => setShowEnvironmentManager(false)}
    >
      {/* Override padding — env manager needs custom layout */}
      <div style={{ display: 'flex', margin: '-16px', height: 480, overflow: 'hidden' }}>
        {/* Sidebar */}
        <div style={{ width: 220, borderRight: '1px solid var(--theme-border)', display: 'flex', flexDirection: 'column', overflow: 'hidden', flexShrink: 0 }}>
          <div style={{ padding: 8, borderBottom: '1px solid var(--theme-border)' }}>
            <button
              onClick={() => setIsCreating(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%', padding: '6px 10px', border: '1px dashed var(--theme-border)', borderRadius: 4, background: 'transparent', color: 'var(--theme-accent)', cursor: 'pointer', fontSize: 11 }}
            >
              <Icon name="add" size={12} /> New Environment
            </button>
          </div>
          <div style={{ flex: 1, overflow: 'auto', padding: 4 }}>
            {isCreating && (
              <div style={{ padding: 4, marginBottom: 4 }}>
                <input
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') setIsCreating(false); }}
                  placeholder="Name..."
                  autoFocus
                  style={S.input}
                />
                <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                  <button onClick={handleCreate} style={S.btnPrimary}>Create</button>
                  <button onClick={() => setIsCreating(false)} style={S.btnSecondary}>Cancel</button>
                </div>
              </div>
            )}
            {environments.map(env => (
              <div
                key={env.id}
                onClick={() => setSelId(env.id)}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', cursor: 'pointer', borderRadius: 4, background: env.id === selId ? 'var(--theme-bg-active)' : 'transparent', marginBottom: 2 }}
                onMouseEnter={e => { if (env.id !== selId) e.currentTarget.style.background = 'var(--theme-bg-hover, var(--theme-bg-active))'; }}
                onMouseLeave={e => { if (env.id !== selId) e.currentTarget.style.background = 'transparent'; }}
              >
                <div style={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0, background: env.isActive ? 'var(--theme-success, #4ade80)' : 'var(--theme-border)' }} />
                <span style={{ flex: 1, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{env.name}</span>
                <span style={{ fontSize: 10, color: 'var(--theme-fg-muted)' }}>{env.variables.length}</span>
              </div>
            ))}
            {environments.length === 0 && !isCreating && (
              <div style={{ padding: '16px 8px', textAlign: 'center', color: 'var(--theme-fg-muted)', fontSize: 11 }}>No environments</div>
            )}
          </div>
        </div>

        {/* Detail */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {sel ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderBottom: '1px solid var(--theme-border)', flexShrink: 0 }}>
                <input
                  value={sel.name}
                  onChange={e => updateEnvironment(sel.id, { name: e.target.value })}
                  style={{ flex: 1, background: 'transparent', border: 'none', color: 'var(--theme-fg)', fontSize: 14, fontWeight: 600, outline: 'none' }}
                />
                <button
                  onClick={() => sel.isActive ? deactivateEnvironment() : activateEnvironment(sel.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', border: '1px solid var(--theme-border)', borderRadius: 4, cursor: 'pointer', fontSize: 11, background: sel.isActive ? 'rgba(74,222,128,0.12)' : 'transparent', color: sel.isActive ? 'var(--theme-success, #4ade80)' : 'var(--theme-fg-muted)' }}
                >
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: sel.isActive ? 'var(--theme-success, #4ade80)' : 'var(--theme-fg-muted)' }} />
                  {sel.isActive ? 'Active' : 'Activate'}
                </button>
                <button onClick={() => duplicateEnvironment(sel.id)} style={S.btnIconOnly} title="Duplicate"><Icon name="copy" size={14} /></button>
                <button
                  onClick={() => { if (confirm('Delete environment?')) { deleteEnvironment(sel.id); setSelId(null); } }}
                  style={{ ...S.btnIconOnly, color: 'var(--theme-error, #f87171)' }}
                  title="Delete"
                >
                  <Icon name="trash" size={14} />
                </button>
              </div>
              <div style={{ flex: 1, overflow: 'auto', padding: '8px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 500 }}>Variables</span>
                  <button onClick={handleAddVar} style={{ ...S.btnGhost, color: 'var(--theme-accent)' }}>
                    <Icon name="add" size={11} /> Add
                  </button>
                </div>
                {sel.variables.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--theme-fg-muted)', fontSize: 12 }}>No variables</div>
                ) : sel.variables.map((v, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 4, alignItems: 'center' }}>
                    <button
                      onClick={() => handleToggleVar(i)}
                      style={{ width: 18, height: 18, border: '1px solid var(--theme-border)', borderRadius: 3, cursor: 'pointer', flexShrink: 0, background: v.enabled ? 'var(--theme-accent)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                      {v.enabled && <Icon name="check" size={10} style={{ color: '#fff' }} />}
                    </button>
                    <input value={v.key} onChange={e => handleUpdateVar(i, 'key', e.target.value)} placeholder="KEY" style={{ ...S.input, fontFamily: 'monospace', opacity: v.enabled ? 1 : 0.6 }} />
                    <input value={v.value} onChange={e => handleUpdateVar(i, 'value', e.target.value)} placeholder="value" style={{ ...S.input, fontFamily: 'monospace', opacity: v.enabled ? 1 : 0.6 }} />
                    <button onClick={() => handleDelVar(i)} style={S.btnIconOnly}><Icon name="close" size={12} /></button>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 8, color: 'var(--theme-fg-muted)' }}>
              <Icon name="symbol-variable" size={32} style={{ opacity: 0.3 }} />
              <div style={{ fontSize: 13 }}>Select or create an environment</div>
            </div>
          )}
        </div>
      </div>
    </ModalShell>
  );
};
