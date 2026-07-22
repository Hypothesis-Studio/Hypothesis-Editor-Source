/**
 * Extension Host - Renderer-side extension lifecycle manager.
 * Bridges main-process extension events to the renderer PluginManager.
 * Handles UI integration: statusbar, panels, sidebar views, notifications.
 */
import type { PluginManifest, PluginContext } from '../../shared/types';
import { createPluginContext, Disposable } from '../plugins/PluginSDK';
import { pluginManager } from '../plugins/PluginManager';
import { useAppStore } from '../stores/appStore';

// ============================================================================
// Extension Types
// ============================================================================

export interface Extension {
  id: string;
  manifest: PluginManifest;
  path: string;
  enabled: boolean;
  activated: boolean;
  context?: PluginContext;
}

// ============================================================================
// Extension Host
// ============================================================================

export interface ExtensionHost {
  loadExtension(manifest: PluginManifest, path: string): Promise<void>;
  activateExtension(id: string): Promise<void>;
  deactivateExtension(id: string): Promise<void>;
  unloadExtension(id: string): Promise<void>;
  getExtension(id: string): Extension | undefined;
  getExtensions(): Extension[];
  getEnabledExtensions(): Extension[];
  getActivatedExtensions(): Extension[];
  initialize(): void;
}

export class ExtensionHostImpl implements ExtensionHost {
  private extensions = new Map<string, Extension>();
  private disposables = new Map<string, Disposable[]>();
  private initialized = false;

  // ── Lifecycle ─────────────────────────────────────────────────

  async loadExtension(manifest: PluginManifest, path: string): Promise<void> {
    const ext: Extension = {
      id: manifest.id,
      manifest,
      path,
      enabled: true,
      activated: false,
    };
    this.extensions.set(manifest.id, ext);
  }

  async activateExtension(id: string): Promise<void> {
    const ext = this.extensions.get(id);
    if (!ext || ext.activated) return;

    try {
      // Create renderer-side context
      const context = createPluginContext(ext.manifest);
      ext.context = context;

      // Load the plugin module via main process IPC
      await (window as any).api.plugin.activate(id);

      ext.activated = true;
      console.log(`Extension activated (renderer): ${id}`);
    } catch (err) {
      console.error(`Failed to activate extension ${id}:`, err);
    }
  }

  async deactivateExtension(id: string): Promise<void> {
    const ext = this.extensions.get(id);
    if (!ext || !ext.activated) return;

    try {
      // Dispose all subscriptions
      const subs = this.disposables.get(id);
      if (subs) {
        subs.forEach(d => d.dispose());
        this.disposables.delete(id);
      }

      if (ext.context) {
        ext.context.subscriptions.forEach(d => d.dispose());
        ext.context.subscriptions.length = 0;
      }

      ext.activated = false;
      ext.context = undefined;
      console.log(`Extension deactivated (renderer): ${id}`);
    } catch (err) {
      console.error(`Failed to deactivate extension ${id}:`, err);
    }
  }

  async unloadExtension(id: string): Promise<void> {
    await this.deactivateExtension(id);
    this.extensions.delete(id);
  }

  getExtension(id: string): Extension | undefined {
    return this.extensions.get(id);
  }

  getExtensions(): Extension[] {
    return Array.from(this.extensions.values());
  }

  getEnabledExtensions(): Extension[] {
    return Array.from(this.extensions.values()).filter((e) => e.enabled);
  }

  getActivatedExtensions(): Extension[] {
    return Array.from(this.extensions.values()).filter((e) => e.activated);
  }

  // ── Initialize IPC listeners for extension UI events ──────────

  initialize(): void {
    if (this.initialized) return;
    this.initialized = true;

    this.setupStatusBarListeners();
    this.setupPanelListeners();
    this.setupNotificationListeners();
    this.setupMessageListeners();
    this.setupSidebarViewListeners();
    this.setupCommandListeners();
    this.setupEditorListeners();
    this.setupThemeListeners();

    console.log('Extension host initialized');
  }

  // ── Status Bar ────────────────────────────────────────────────

  private extensionStatusBarItems = new Map<string, { text: string; alignment: 'left' | 'right'; priority: number }>();

  private setupStatusBarListeners(): void {
    const api = (window as any).api;

    api.extension.ui.onSetStatusBar?.((data: { id: string; text: string; alignment: string; priority?: number }) => {
      this.extensionStatusBarItems.set(data.id, {
        text: data.text,
        alignment: data.alignment as 'left' | 'right',
        priority: data.priority ?? 0,
      });
      this.emitStatusBarUpdate();
    });

    api.extension.ui.onUpdateStatusBar?.((data: { id: string; text: string }) => {
      const item = this.extensionStatusBarItems.get(data.id);
      if (item) {
        item.text = data.text;
        this.emitStatusBarUpdate();
      }
    });
  }

  private emitStatusBarUpdate(): void {
    // Dispatch custom event for StatusBar component to pick up
    window.dispatchEvent(new CustomEvent('extension:statusbar:update', {
      detail: Array.from(this.extensionStatusBarItems.entries()),
    }));
  }

  getExtensionStatusBarItems(): Array<{ id: string; text: string; alignment: 'left' | 'right'; priority: number }> {
    return Array.from(this.extensionStatusBarItems.entries()).map(([id, item]) => ({
      id,
      ...item,
    }));
  }

  // ── Panels ────────────────────────────────────────────────────

  private extensionPanels = new Map<string, { title: string; content: string; visible: boolean }>();

  private setupPanelListeners(): void {
    const api = (window as any).api;

    api.extension.ui.onCreatePanel?.((data: { id: string; title: string; content: string }) => {
      this.extensionPanels.set(data.id, {
        title: data.title,
        content: data.content,
        visible: true,
      });
      window.dispatchEvent(new CustomEvent('extension:panel:create', { detail: data }));
    });

    api.extension.ui.onUpdatePanel?.((data: { id: string; content: string }) => {
      const panel = this.extensionPanels.get(data.id);
      if (panel) {
        panel.content = data.content;
        window.dispatchEvent(new CustomEvent('extension:panel:update', { detail: data }));
      }
    });

    api.extension.ui.onShowPanel?.((data: { id: string }) => {
      const panel = this.extensionPanels.get(data.id);
      if (panel) {
        panel.visible = true;
        window.dispatchEvent(new CustomEvent('extension:panel:show', { detail: data }));
      }
    });

    api.extension.ui.onHidePanel?.((data: { id: string }) => {
      const panel = this.extensionPanels.get(data.id);
      if (panel) {
        panel.visible = false;
        window.dispatchEvent(new CustomEvent('extension:panel:hide', { detail: data }));
      }
    });
  }

  getExtensionPanels(): Array<{ id: string; title: string; content: string; visible: boolean }> {
    return Array.from(this.extensionPanels.entries()).map(([id, panel]) => ({
      id,
      ...panel,
    }));
  }

  // ── Sidebar Views ─────────────────────────────────────────────

  private extensionSidebarViews = new Map<string, { title: string; content: string; visible: boolean }>();

  private setupSidebarViewListeners(): void {
    const api = (window as any).api;

    api.extension.ui.onCreateSidebarView?.((data: { id: string; title: string; content: string }) => {
      this.extensionSidebarViews.set(data.id, {
        title: data.title,
        content: data.content,
        visible: false,
      });
      window.dispatchEvent(new CustomEvent('extension:sidebar:create', { detail: data }));
    });

    api.extension.ui.onShowSidebarView?.((data: { id: string }) => {
      const view = this.extensionSidebarViews.get(data.id);
      if (view) {
        view.visible = true;
        // Switch sidebar to this view
        const appStore = useAppStore.getState();
        appStore.setActiveSidebarView(data.id);
        window.dispatchEvent(new CustomEvent('extension:sidebar:show', { detail: data }));
      }
    });
  }

  getExtensionSidebarViews(): Array<{ id: string; title: string; content: string; visible: boolean }> {
    return Array.from(this.extensionSidebarViews.entries()).map(([id, view]) => ({
      id,
      ...view,
    }));
  }

  // ── Notifications ─────────────────────────────────────────────

  private setupNotificationListeners(): void {
    const api = (window as any).api;

    api.extension.ui.onNotification?.((data: { message: string; type: string }) => {
      const appStore = useAppStore.getState();
      appStore.setStatusMessage(data.message, data.type as any);
      window.dispatchEvent(new CustomEvent('extension:notification', { detail: data }));
    });
  }

  // ── Messages (info/warning/error dialogs) ─────────────────────

  private setupMessageListeners(): void {
    const api = (window as any).api;

    api.extension.ui.onMessage?.((data: { type: string; message: string; items?: string[] }) => {
      // Show via the app's status message system
      const appStore = useAppStore.getState();
      appStore.setStatusMessage(data.message, data.type as any);
      window.dispatchEvent(new CustomEvent('extension:message', { detail: data }));
    });
  }

  // ── Commands ──────────────────────────────────────────────────

  private setupCommandListeners(): void {
    const api = (window as any).api;

    // Listen for command registration from main process
    api.menu.onChannel?.('extension:command-registered', (data: { pluginId: string; commandId: string }) => {
      console.log(`Extension command registered: ${data.commandId} (from ${data.pluginId})`);
      window.dispatchEvent(new CustomEvent('extension:command:registered', { detail: data }));
    });

    // Listen for commands-changed notification
    api.menu.onChannel?.('extension:commands-changed', () => {
      window.dispatchEvent(new CustomEvent('extension:commands:changed'));
    });
  }

  // ── Editor Events ─────────────────────────────────────────────

  private setupEditorListeners(): void {
    const api = (window as any).api;

    // Listen for editor open file requests from extensions
    api.extension.editor.onOpenFile?.((data: { filePath: string; content: string }) => {
      window.dispatchEvent(new CustomEvent('extension:editor:openFile', { detail: data }));
    });

    api.extension.editor.onFileSaved?.((data: { filePath: string }) => {
      window.dispatchEvent(new CustomEvent('extension:editor:fileSaved', { detail: data }));
    });
  }

  // ── Theme Events ──────────────────────────────────────────────

  private setupThemeListeners(): void {
    const api = (window as any).api;

    api.extension.theme.onRegistered?.((themeDef: unknown) => {
      window.dispatchEvent(new CustomEvent('extension:theme:registered', { detail: themeDef }));
    });
  }

  // ── Execute extension command (renderer-side) ─────────────────

  async executeCommand(commandId: string, args?: unknown[]): Promise<unknown> {
    // Try renderer-side first
    for (const [, ext] of this.extensions) {
      if (!ext.activated || !ext.context) continue;
      // Check if this extension has the command
      const contribs = ext.manifest.contributes?.commands || [];
      if (contribs.some(c => c.command === commandId)) {
        // Delegate to main process which has the actual handler
        return (window as any).api.plugin.executeCommand(commandId, args);
      }
    }
    // Fallback to main process
    return (window as any).api.plugin.executeCommand(commandId, args);
  }
}

// Singleton
export const extensionHost = new ExtensionHostImpl();
