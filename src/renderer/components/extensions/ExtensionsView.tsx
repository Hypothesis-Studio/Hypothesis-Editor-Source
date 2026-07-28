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
  const [detailTab, setDetailTab] = useState<'detail' | 'description' | 'note'>('detail');
  const [readmeContent, setReadmeContent] = useState<string>('');
  const [readmeHtml, setReadmeHtml] = useState<string>('');
  const [sortBy, setSortBy] = useState<'name' | 'recent'>('name');
  const [isDragOver, setIsDragOver] = useState(false);

  useEffect(() => { loadPlugins(); }, [loadPlugins]);

  // Auto-refresh when extensions change
  useEffect(() => {
    const unsub1 = (window as any).api?.menu?.onChannel?.('extension:commands-changed', () => loadPlugins());
    const unsub2 = (window as any).api?.menu?.onChannel?.('extension:command-registered', () => loadPlugins());
    return () => { unsub1?.(); unsub2?.(); };
  }, [loadPlugins]);

  // Actions

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

  // Drag & Drop

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    const hypFiles = files.filter(f => f.name.endsWith('.hyp'));
    if (hypFiles.length === 0) {
      setStatusMessage('No .hyp files found. Drop a Hypothesis extension file.', 'warning');
      return;
    }
    setIsInstalling(true);
    for (const file of hypFiles) {
      try {
        const filePath = (file as any).path as string;
        if (!filePath) continue;
        await window.api.plugin.installHyp(filePath);
        setStatusMessage(`Installed: ${file.name}`, 'success');
      } catch (err: any) {
        setStatusMessage(`Failed to install ${file.name}: ${err.message}`, 'error');
      }
    }
    setIsInstalling(false);
    await loadPlugins();
  }, [loadPlugins, setStatusMessage]);

  // Filtering & sorting

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

  // Load README.md when selecting a plugin
  useEffect(() => {
    if (selectedPlugin && selected) {
      setDetailTab('detail');
      setReadmeContent('');
      const readmePath = selected.path + '\\README.md';
      window.api.file.read(readmePath).then(async (content: string) => {
        const md = content || '';
        setReadmeContent(md);
        if (md) {
          try {
            const res = await window.api.preview.renderMarkdown(md);
            setReadmeHtml(res?.data || '');
          } catch { setReadmeHtml(''); }
        } else { setReadmeHtml(''); }
      }).catch(async () => {
        try {
          const content = await window.api.file.read(selected.path + '\\readme.md');
          const md = content || '';
          setReadmeContent(md);
          if (md) {
            const res = await window.api.preview.renderMarkdown(md);
            setReadmeHtml(res?.data || '');
          } else { setReadmeHtml(''); }
        } catch { setReadmeContent(''); setReadmeHtml(''); }
      });
    }
  }, [selectedPlugin]);

  // Detail Panel

  if (selected) {
    const m = selected.manifest;

    return (
      <div className="flex flex-col h-full" style={{ background: 'var(--theme-bg)' }}>
        {/* Detail Header */}
        <div className="flex items-center gap-2 px-3 py-1.5" style={{ borderBottom: '1px solid var(--theme-border)' }}>
          <button onClick={() => setSelectedPlugin(null)} className="p-0.5 rounded" style={{ color: 'var(--theme-fg-muted)', background: 'none', border: 'none', cursor: 'pointer' }} title="Back to list">
            <Icon name="chevron-left" size={14} />
          </button>
          <span className="text-xs font-semibold" style={{ color: 'var(--theme-fg)' }}>{m.name || m.id}</span>
          <span className="text-[9px] px-1 rounded" style={{ background: 'var(--theme-bg-tertiary)', color: 'var(--theme-fg-muted)' }}>
            v{m.version || '1.0.0'}
          </span>
        </div>

        {/* Extension info card */}
        <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--theme-border)' }}>
          <div className="flex items-start gap-2">
            <div className="w-10 h-10 rounded flex items-center justify-center text-sm flex-shrink-0" style={{ background: 'var(--theme-bg-tertiary)', color: 'var(--theme-accent)' }}>
              {(m.name || m.id || '?')[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-xs font-bold" style={{ color: 'var(--theme-fg)' }}>{m.name || m.id}</h2>
              <p className="text-[10px] mt-0.5 line-clamp-2" style={{ color: 'var(--theme-fg-muted)' }}>{m.description || 'No description'}</p>
              <div className="flex flex-wrap gap-1 mt-1.5">
                {m.author && (
                  <span className="text-[9px] px-1 py-0.5 rounded" style={{ background: 'var(--theme-bg-tertiary)', color: 'var(--theme-fg-muted)' }}>{m.author}</span>
                )}
                {m.license && (
                  <span className="text-[9px] px-1 py-0.5 rounded" style={{ background: 'var(--theme-bg-tertiary)', color: 'var(--theme-fg-muted)' }}>{m.license}</span>
                )}
                <span className="text-[9px] px-1 py-0.5 rounded" style={{ background: selected.enabled ? 'var(--theme-success)' : 'var(--theme-bg-tertiary)', color: selected.enabled ? '#fff' : 'var(--theme-fg-muted)' }}>
                  {selected.enabled ? 'Enabled' : 'Disabled'}
                </span>
                {selected.activated && (
                  <span className="text-[9px] px-1 py-0.5 rounded" style={{ background: 'var(--theme-accent)', color: '#fff' }}>Active</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="px-3 py-1.5 flex gap-1" style={{ borderBottom: '1px solid var(--theme-border)' }}>
          <button onClick={() => handleToggle(m.id, selected.enabled)} style={{ fontSize: 10, padding: '2px 8px', borderRadius: 3, background: selected.enabled ? 'var(--theme-bg-tertiary)' : 'var(--theme-accent)', color: selected.enabled ? 'var(--theme-fg)' : '#ffffff', border: selected.enabled ? '1px solid var(--theme-border-light)' : 'none', cursor: 'pointer' }}>
            {selected.enabled ? 'Disable' : 'Enable'}
          </button>
          <button onClick={() => handleExportHyp(m.id)} style={{ fontSize: 10, padding: '2px 8px', borderRadius: 3, background: 'var(--theme-bg-tertiary)', color: 'var(--theme-fg)', border: '1px solid var(--theme-border-light)', cursor: 'pointer' }}>
            Export
          </button>
          <button onClick={() => handleUninstall(m.id, m.name || m.id)} style={{ fontSize: 10, padding: '2px 8px', borderRadius: 3, background: 'var(--theme-error)', color: '#ffffff', border: 'none', cursor: 'pointer' }}>
            Uninstall
          </button>
        </div>

        {/* Tabs */}
        <div className="flex px-3" style={{ borderBottom: '1px solid var(--theme-border)' }}>
          {(['detail', 'description', 'note'] as const).map((tab) => (
            <button key={tab} onClick={() => setDetailTab(tab)} style={{ fontSize: 11, padding: '4px 10px', background: 'none', border: 'none', cursor: 'pointer', color: detailTab === tab ? 'var(--theme-accent)' : 'var(--theme-fg-muted)', borderBottom: detailTab === tab ? '2px solid var(--theme-accent)' : '2px solid transparent', fontWeight: detailTab === tab ? 600 : 400 }}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="px-3 py-1.5 overflow-auto flex-1" style={{ fontSize: 11, color: 'var(--theme-fg)' }}>
          {detailTab === 'detail' && (
            <div className="space-y-1">
              <InfoRow label="ID" value={m.id} />
              <InfoRow label="Version" value={m.version || '1.0.0'} />
              {m.author && <InfoRow label="Author" value={m.author} />}
              {m.license && <InfoRow label="License" value={m.license} />}
              {m.main && <InfoRow label="Entry" value={m.main} />}
              {m.activationEvents && m.activationEvents.length > 0 && (
                <InfoRow label="Activation" value={m.activationEvents.join(', ')} />
              )}
              {m.keywords && m.keywords.length > 0 && (
                <InfoRow label="Keywords" value={m.keywords.join(', ')} />
              )}
              {m.contributes?.themes && m.contributes.themes.length > 0 && (
                <InfoRow label="Themes" value={m.contributes.themes.map(t => t.label || t.id).join(', ')} />
              )}
              {m.contributes?.commands && m.contributes.commands.length > 0 && (
                <InfoRow label="Commands" value={m.contributes.commands.map(c => c.title || c.command).join(', ')} />
              )}
              <InfoRow label="Status" value={selected.enabled ? (selected.activated ? 'Active' : 'Enabled') : 'Disabled'} />
              <InfoRow label="Path" value={selected.path} />
            </div>
          )}
          {detailTab === 'description' && (
            <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6, color: 'var(--theme-fg)', fontSize: 11 }}>
              {m.description || 'No description provided.'}
            </p>
          )}
          {detailTab === 'note' && (
            readmeHtml ? (
              <div className="markdown-preview" style={{ fontSize: 11, lineHeight: 1.6, color: 'var(--theme-fg)' }} dangerouslySetInnerHTML={{ __html: readmeHtml }} />
            ) : readmeContent ? (
              <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: 11, lineHeight: 1.6, color: 'var(--theme-fg)', margin: 0 }}>
                {readmeContent}
              </pre>
            ) : (
              <p style={{ color: 'var(--theme-fg-muted)', fontSize: 11 }}>No README.md found for this extension.</p>
            )
          )}
        </div>
      </div>
    );
  }

  // List View

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--theme-bg)' }}
      onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}>
      {isDragOver && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 50, background: 'rgba(0, 122, 204, 0.15)', border: '2px dashed var(--theme-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
          <div style={{ padding: 16, borderRadius: 8, background: 'var(--theme-bg-secondary)', border: '1px solid var(--theme-accent)', color: 'var(--theme-fg)', fontSize: 13, fontWeight: 600 }}>
            Drop .hyp to install
          </div>
        </div>
      )}
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
              <button key={f} onClick={() => setFilter(f)} className="px-2 py-0.5 text-[10px] rounded"
                style={{ background: filter === f ? 'var(--theme-accent)' : 'var(--theme-bg-tertiary)', color: filter === f ? '#ffffff' : 'var(--theme-fg-muted)', border: 'none', cursor: 'pointer' }}>
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value as 'name' | 'recent')}
            className="text-[10px] rounded px-1.5 py-0.5 outline-none"
            style={{ background: 'var(--theme-bg-tertiary)', color: 'var(--theme-fg-muted)', border: '1px solid var(--theme-border-light)', cursor: 'pointer' }}>
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
            <div key={m.id} className="px-3 py-2.5 cursor-pointer group transition-colors" style={{ borderBottom: '1px solid var(--theme-border)' }}
              onClick={() => setSelectedPlugin(m.id)}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--theme-bg-hover)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = ''; }}>
              <div className="flex items-start gap-2.5">
                {m.icon ? (
                  <img src={m.icon} alt="" className="w-9 h-9 rounded object-cover flex-shrink-0 mt-0.5" style={{ background: 'var(--theme-bg-tertiary)' }}
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                ) : (
                  <div className="w-9 h-9 rounded flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5"
                    style={{ background: 'var(--theme-bg-tertiary)', color: plugin.enabled ? 'var(--theme-accent)' : 'var(--theme-fg-dim)' }}>
                    {(m.name || m.id || '?')[0].toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold truncate" style={{ color: plugin.enabled ? 'var(--theme-fg)' : 'var(--theme-fg-muted)' }}>{m.name || m.id}</span>
                    <span className="text-[9px] px-1 rounded flex-shrink-0" style={{ background: 'var(--theme-bg-tertiary)', color: 'var(--theme-fg-dim)' }}>v{m.version || '1.0.0'}</span>
                    {!plugin.enabled && (
                      <span className="text-[9px] px-1 rounded flex-shrink-0" style={{ background: 'var(--theme-bg-tertiary)', color: 'var(--theme-fg-dim)' }}>Disabled</span>
                    )}
                  </div>
                  <p className="text-[11px] mt-0.5 line-clamp-2" style={{ color: 'var(--theme-fg-muted)' }}>{m.description || 'No description provided'}</p>
                  {m.author && <span className="text-[10px] mt-1" style={{ color: 'var(--theme-fg-dim)' }}>{m.author}</span>}
                </div>
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                  <button onClick={(e) => { e.stopPropagation(); handleToggle(m.id, plugin.enabled); }}
                    className="p-1 rounded" style={{ color: plugin.enabled ? 'var(--theme-success)' : 'var(--theme-fg-muted)' }} title={plugin.enabled ? 'Disable' : 'Enable'}>
                    <Icon name={plugin.enabled ? "close" : "check"} size={12} />
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); handleExportHyp(m.id); }}
                    className="p-1 rounded" style={{ color: 'var(--theme-fg-muted)' }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--theme-fg)'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--theme-fg-muted)'; }}
                    title="Export as .hyp">
                    <Icon name="download" size={12} />
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); handleUninstall(m.id, m.name || m.id); }}
                    className="p-1 rounded" style={{ color: 'var(--theme-fg-muted)' }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--theme-error)'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--theme-fg-muted)'; }}
                    title="Uninstall">
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

// Helper components

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div>
    <h3 className="text-[11px] font-semibold mb-2" style={{ color: 'var(--theme-fg)' }}>{title}</h3>
    {children}
  </div>
);

const InfoRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="flex items-start gap-2 py-0.5">
    <span className="text-[10px] w-16 flex-shrink-0" style={{ color: 'var(--theme-fg-muted)' }}>{label}</span>
    <span className="text-[11px] break-all flex-1" style={{ color: 'var(--theme-fg)' }}>{value}</span>
  </div>
);
