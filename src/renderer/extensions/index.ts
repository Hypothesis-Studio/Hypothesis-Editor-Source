/**
 * Extensions Module - Extension system for the renderer.
 */
import type { PluginManifest } from '../../shared/types';

export interface Extension {
  id: string;
  manifest: PluginManifest;
  path: string;
  enabled: boolean;
  activated: boolean;
}

export interface ExtensionHost {
  loadExtension(manifest: PluginManifest, path: string): Promise<void>;
  activateExtension(id: string): Promise<void>;
  deactivateExtension(id: string): Promise<void>;
  unloadExtension(id: string): Promise<void>;
  getExtension(id: string): Extension | undefined;
  getExtensions(): Extension[];
}

export class ExtensionHostImpl implements ExtensionHost {
  private extensions = new Map<string, Extension>();

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
    if (ext && ext.enabled) {
      ext.activated = true;
    }
  }

  async deactivateExtension(id: string): Promise<void> {
    const ext = this.extensions.get(id);
    if (ext) {
      ext.activated = false;
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
}

export const extensionHost = new ExtensionHostImpl();
