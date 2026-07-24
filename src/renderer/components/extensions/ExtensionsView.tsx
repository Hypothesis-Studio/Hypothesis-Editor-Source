/**
 * ExtensionsView — Professional extensions management panel.
 * Supports .hyp install, detail view, enable/disable, uninstall, export.
 */
import React, { useEffect, useState, useCallback } from 'react';
import { usePluginStore } from '../../stores/pluginStore';
import { useAppStore } from '../../stores/appStore';
import { showConfirm } from '../../stores/dialogStore';
import { Icon } from '../common/Icon';

interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  license?: string;
  keywords?: string[];
  main?: string;
  activationEvents?: string[];
  icon?: string;
  contributes?: {
    commands?: Array<{ command: string; title: string; keybinding?: string }>;
    views?: Array<{ id: string; name: string }>;
    themes?: Array<{ id: string; label: string }>;
    languages?: Array<{ id: string }>;
  };
}

interface PluginInfo {
  manifest: PluginManifest;
  enabled: boolean;
  loaded: boolean;
  activated: boolean;
  path: string;
}

export const ExtensionsView: React.FC = () => {
  const { plugins, loadPlugins, uninstallPlugin, enablePlugin, disablePlugin } = usePluginStore();
  const { setStatusMessage } = useAppStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [isInstalling, setIsInstalling] = useState(false);
  const [filter, setFilter] = useState<'all' | 'enabled' | 'disabled'>('all');
  const [selectedPlugin, setSelectedPlugin] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'name' | 'recent'>('name');

  useEffect(() => { loadPlugins(); }, [loadPlugins]);

  // Auto-refresh when extensions change (install/uninstall/enable/disable)
  useEffect(() => {
    const unsub1 = (window as any).api?.menu?.onChannel?.('extension:commands-changed', () => loadPlugins());
    const unsub2 = (window as any).api?.menu?.onChannel?.('extension:command-registered', () => loadPlugins());
    return () => { unsub1?.(); unsub2?.(); };
  }, [loadPlugins]);

  // ── Actions ─────────────────────────────────────────────────────

  const handleInstallHyp = useCallback(async () => {
    setIsInstalling(true);
    try {
      const result = await window.api.file.dialogOpen({
        filters: [{ name: 'Hypothesis Extension', extensions: ['hyp'] }],
        properties: ['openFile'],
      });
      if (!result.canceled && result.filePaths.length > 0) {
        await window.api.plugin.installHyp(result.filePaths[0]);
        setStatusMessage('Extension installed successfully', 'success');
        await loadPlugins();
      }
    } catch (error) {
      console.error('Failed to install extension:', error);
      setStatusMessage('Failed to install extension', 'error');
    }
    setIsInstalling(false);
  }, [loadPlugins, setStatusMessage]);

  const handleUninstall = useCallback(async (pluginId: string, pluginName: string) => {
    const confirmed = await showConfirm(
      `Uninstall extension "${pluginName}"?\n\nThis will remove the extension completely.`,
      'Uninstall Extension'
    );
    if (!confirmed) return;
    try {
      await uninstallPlugin(pluginId);
      setStatusMessage(`"${pluginName}" uninstalled`, 'success');
      if (selectedPlugin === pluginId) setSelectedPlugin(null);
      await loadPlugins();
    } catch (error) {
      setStatusMessage('Failed to uninstall extension', 'error');
    }
  }, [uninstallPlugin, loadPlugins, setStatusMessage, selectedPlugin]);

  const handleToggle = useCallback(async (pluginId: string, currentlyEnabled: boolean) => {
    try {
      if (currentlyEnabled) {
        await disablePlugin(pluginId);
        setStatusMessage('Extension disabled', 'info');
      } else {
        await enablePlugin(pluginId);
        setStatusMessage('Extension enabled', 'info');
      }
      await loadPlugins();
    } catch (error) {
      setStatusMessage('Failed to toggle extension', 'error');
    }
  }, [enablePlugin, disablePlugin, loadPlugins, setStatusMessage]);

  const handleExportHyp = useCallback(async (pluginId: string) => {
    try {
      const plugin = plugins.find(p => p.manifest.id === pluginId);
      if (!plugin) return;
      const outputPath = await window.api.plugin.pack(plugin.path);
      setStatusMessage(`Exported to ${outputPath}`, 'success');
    } catch (error) {
      setStatusMessage('Failed to export extension', 'error');
    }
  }, [plugins, setStatusMessage]);

  // ── Filtering & sorting ─────────────────────────────────────────

  const filteredPlugins = (plugins as PluginInfo[])
    .filter(p => {
      if (filter === 'enabled' && !p.enabled) return false;
      if (filter === 'disabled' && p.enabled) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          p.manifest.name?.toLowerCase().includes(q) ||
          p.manifest.description?.toLowerCase().includes(q) ||
          p.manifest.id?.toLowerCase().includes(q) ||
          p.manifest.author?.toLowerCase().includes(q) ||
          p.manifest.keywords?.some(k => k.toLowerCase().includes(q))
        );
      }
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'name') return (a.manifest.name || a.manifest.id).localeCompare(b.manifest.name || b.manifest.id);
      return 0;
    });

  const selected = selectedPlugin ? (plugins as PluginInfo[]).find(p => p.manifest.id === selectedPlugin) : null;

  // ── Detail Panel ────────────────────────────────────────────────

  if (selected) {
    const m = selected.manifest;

    return (
      <div className="flex flex-col h-full" style={{ background: 'var(--theme-bg)' }}>
        {/* Detail Header */}
        <div className="flex items-center gap-2 px-3 py-2" style={{ borderBottom: '1px solid var(--theme-border)' }}>
          <button onClick={() => setSelectedPlugin(null)} className="p-1 rounded" style={{ color: 'var(--theme-fg-muted)' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--theme-fg)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--theme-fg-muted)'; }}
            title="Back to list"
          >
            <Icon name="chevron-left" size={14} />
          </button>
          <span className="text-xs font-semibold" style={{ color: 'var(--theme-fg)' }}>{m.name || m.id}</span>
          <span className="text-[10px] px-1 rounded" style={{ background: 'var(--theme-bg-tertiary)', color: 'var(--theme-fg-muted)' }}>
            v{m.version || '1.0.0'}
          </span>
        </div>

        {/* Detail Content */}
        <div className="flex-1 overflow-auto">
          {/* Extension info card */}
          <div className="px-4 py-4" style={{ borderBottom: '1px solid var(--theme-border)' }}>
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 rounded-lg flex items-center justify-center text-lg flex-shrink-0"
                style={{ background: 'var(--theme-bg-tertiary)', color: 'var(--theme-accent)' }}>
                {(m.name || m.id || '?')[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-sm font-bold" style={{ color: 'var(--theme-fg)' }}>{m.name || m.id}</h2>
                <p className="text-[11px] mt-0.5" style={{ color: 'var(--theme-fg-muted)' }}>{m.description || 'No description'}</p>
                <div className="flex flex-wrap gap-2 mt-2">
                  {m.author && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'var(--theme-bg-tertiary)', color: 'var(--theme-fg-muted)' }}>
                      {m.author}
                    </span>
                  )}
                  {m.license && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'var(--theme-bg-tertiary)', color: 'var(--theme-fg-muted)' }}>
                      {m.license}
                    </span>
                  )}
                  <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'var(--theme-bg-tertiary)', color: 'var(--theme-fg-muted)' }}>
                    {selected.enabled ? 'Enabled' : 'Disabled'}
                  </span>
                  {selected.activated && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'var(--theme-success)', color: '#ffffff' }}>
                      Active
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="px-4 py-3 flex gap-2" style={{ borderBottom: '1px solid var(--theme-border)' }}>
            <button onClick={() => handleToggle(m.id, selected.enabled)}
              className="btn text-xs flex-1"
              style={{
                background: selected.enabled ? 'var(--theme-bg-tertiary)' : 'var(--theme-accent)',
                color: selected.enabled ? 'var(--theme-fg)' : '#ffffff',
                border: selected.enabled ? '1px solid var(--theme-border-light)' : 'none',
              }}
            >
              {selected.enabled ? 'Disable' : 'Enable'}
            </button>
            <button onClick={() => handleExportHyp(m.id)}
              className="btn btn-secondary text-xs"
            >
              Export
            </button>
            <button onClick={() => handleUninstall(m.id, m.name || m.id)}
              className="btn text-xs"
              style={{ background: 'var(--theme-error)', color: '#ffffff', border: 'none' }}
            >
              Uninstall
            </button>
          </div>

          {/* Details section */}
          <div className="px-4 py-3 space-y-3">
            <Section title="Details">
              <InfoRow label="ID" value={m.id} />
              <InfoRow label="Version" value={m.version || '1.0.0'} />
              {m.author && <InfoRow label="Author" value={m.author} />}
              {m.license && <InfoRow label="License" value={m.license} />}
              {m.keywords && m.keywords.length > 0 && (
                <InfoRow label="Keywords" value={m.keywords.join(', ')} />
              )}
            </Section>
          </div>
        </div>
      </div>
    );
  }

  // ── List View ───────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--theme-bg)' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2" style={{ borderBottom: '1px solid var(--theme-border)' }}>
        <span className="text-xs font-semibold" style={{ color: 'var(--theme-fg)' }}>Extensions</span>
        <div className="flex items-center gap-1">
          <button onClick={handleInstallHyp} className="p-1 rounded" style={{ color: 'var(--theme-fg-muted)' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--theme-bg-hover)'; (e.currentTarget as HTMLElement).style.color = 'var(--theme-fg)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = ''; (e.currentTarget as HTMLElement).style.color = 'var(--theme-fg-muted)'; }}
            title="Install Extension (.hyp)"
          >
            <Icon name="add" size={14} />
          </button>
          <button onClick={loadPlugins} className="p-1 rounded" style={{ color: 'var(--theme-fg-muted)' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--theme-bg-hover)'; (e.currentTarget as HTMLElement).style.color = 'var(--theme-fg)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = ''; (e.currentTarget as HTMLElement).style.color = 'var(--theme-fg-muted)'; }}
            title="Refresh"
          >
            <Icon name="refresh" size={14} />
          </button>
        </div>
      </div>

      {/* Search + Filter + Sort */}
      <div className="px-3 py-2 space-y-2" style={{ borderBottom: '1px solid var(--theme-border)' }}>
        <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search extensions by name, author, keyword..." className="input text-xs w-full" />
        <div className="flex items-center justify-between">
          <div className="flex gap-1">
            {(['all', 'enabled', 'disabled'] as const).map((f) => (
              <button key={f} onClick={() => setFilter(f)}
                className="px-2 py-0.5 text-[10px] rounded"
                style={{
                  background: filter === f ? 'var(--theme-accent)' : 'var(--theme-bg-tertiary)',
                  color: filter === f ? '#ffffff' : 'var(--theme-fg-muted)',
                  border: 'none', cursor: 'pointer',
                }}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value as 'name' | 'recent')}
            className="text-[10px] rounded px-1.5 py-0.5 outline-none"
            style={{ background: 'var(--theme-bg-tertiary)', color: 'var(--theme-fg-muted)', border: '1px solid var(--theme-border-light)', cursor: 'pointer' }}
          >
            <option value="name">Sort by Name</option>
            <option value="recent">Sort by Recent</option>
          </select>
        </div>
      </div>

      {/* Extensions list */}
      <div className="flex-1 overflow-auto">
        {isInstalling && (
          <div className="p-4 text-center text-xs" style={{ color: 'var(--theme-fg-muted)' }}>
            <Icon name="loading" size={20} className="mx-auto mb-2 animate-spin" />
            Installing extension...
          </div>
        )}

        {!isInstalling && filteredPlugins.length === 0 && (
          <div className="p-8 text-center">
            <Icon name="extensions" size={48} className="mx-auto mb-3" style={{ color: 'var(--theme-fg-dim)' }} />
            <p className="text-xs mb-1" style={{ color: 'var(--theme-fg-muted)' }}>
              {searchQuery ? 'No extensions match your search' : 'No extensions installed'}
            </p>
            <p className="text-[10px]" style={{ color: 'var(--theme-fg-dim)' }}>
              {searchQuery ? 'Try a different search term' : 'Click + to install a .hyp extension file'}
            </p>
          </div>
        )}

        {filteredPlugins.map((plugin) => {
          const m = plugin.manifest;

          return (
            <div key={m.id}
              className="px-3 py-2.5 cursor-pointer group transition-colors"
              style={{ borderBottom: '1px solid var(--theme-border)' }}
              onClick={() => setSelectedPlugin(m.id)}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--theme-bg-hover)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = ''; }}
            >
              <div className="flex items-start gap-2.5">
                {/* Icon */}
                {m.icon ? (
                  <img src={m.icon} alt="" className="w-9 h-9 rounded object-cover flex-shrink-0 mt-0.5"
                    style={{ background: 'var(--theme-bg-tertiary)' }}
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                  />
                ) : (
                  <div className="w-9 h-9 rounded flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5"
                    style={{ background: 'var(--theme-bg-tertiary)', color: plugin.enabled ? 'var(--theme-accent)' : 'var(--theme-fg-dim)' }}>
                    {(m.name || m.id || '?')[0].toUpperCase()}
                  </div>
                )}

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold truncate" style={{ color: plugin.enabled ? 'var(--theme-fg)' : 'var(--theme-fg-muted)' }}>
                      {m.name || m.id}
                    </span>
                    <span className="text-[9px] px-1 rounded flex-shrink-0" style={{ background: 'var(--theme-bg-tertiary)', color: 'var(--theme-fg-dim)' }}>
                      v{m.version || '1.0.0'}
                    </span>
                    {!plugin.enabled && (
                      <span className="text-[9px] px-1 rounded flex-shrink-0" style={{ background: 'var(--theme-bg-tertiary)', color: 'var(--theme-fg-dim)' }}>
                        Disabled
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] mt-0.5 line-clamp-2" style={{ color: 'var(--theme-fg-muted)' }}>
                    {m.description || 'No description provided'}
                  </p>
                  {m.author && (
                    <span className="text-[10px] mt-1" style={{ color: 'var(--theme-fg-dim)' }}>{m.author}</span>
                  )}
                </div>

                {/* Quick actions (visible on hover) */}
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                  <button
                    onClick={(e) => { e.stopPropagation(); handleToggle(m.id, plugin.enabled); }}
                    className="p-1 rounded" style={{ color: plugin.enabled ? 'var(--theme-success)' : 'var(--theme-fg-muted)' }}
                    title={plugin.enabled ? 'Disable' : 'Enable'}
                  >
                    <Icon name={plugin.enabled ? "close" : "check"} size={12} />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleExportHyp(m.id); }}
                    className="p-1 rounded" style={{ color: 'var(--theme-fg-muted)' }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--theme-fg)'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--theme-fg-muted)'; }}
                    title="Export as .hyp"
                  >
                    <Icon name="download" size={12} />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleUninstall(m.id, m.name || m.id); }}
                    className="p-1 rounded" style={{ color: 'var(--theme-fg-muted)' }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--theme-error)'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--theme-fg-muted)'; }}
                    title="Uninstall"
                  >
                    <Icon name="trash" size={12} />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="px-3 py-1.5 text-[10px] flex items-center justify-between" style={{ borderTop: '1px solid var(--theme-border)', color: 'var(--theme-fg-muted)' }}>
        <span>{plugins.length} extension{plugins.length !== 1 ? 's' : ''} installed</span>
        <span>{plugins.filter(p => p.enabled).length} enabled</span>
      </div>
    </div>
  );
};

// ── Helper components ─────────────────────────────────────────────

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div>
    <h3 className="text-[11px] font-semibold mb-2" style={{ color: 'var(--theme-fg)' }}>{title}</h3>
    {children}
  </div>
);

const InfoRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="flex items-start gap-3 py-1">
    <span className="text-[10px] w-20 flex-shrink-0" style={{ color: 'var(--theme-fg-muted)' }}>{label}</span>
    <span className="text-[11px] break-all" style={{ color: 'var(--theme-fg)' }}>{value}</span>
  </div>
);
