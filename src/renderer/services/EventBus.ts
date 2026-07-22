/**
 * Event Bus - Central event system for cross-component communication.
 */
type EventListener<T = unknown> = (data: T) => void;

interface EventEntry {
  listener: EventListener;
  once: boolean;
}

export class EventBus {
  private events = new Map<string, EventEntry[]>();

  on<T = unknown>(event: string, listener: EventListener<T>): () => void {
    if (!this.events.has(event)) {
      this.events.set(event, []);
    }

    const entry: EventEntry = { listener: listener as EventListener, once: false };
    this.events.get(event)!.push(entry);

    return () => this.off(event, listener);
  }

  once<T = unknown>(event: string, listener: EventListener<T>): () => void {
    if (!this.events.has(event)) {
      this.events.set(event, []);
    }

    const entry: EventEntry = { listener: listener as EventListener, once: true };
    this.events.get(event)!.push(entry);

    return () => this.off(event, listener);
  }

  off<T = unknown>(event: string, listener: EventListener<T>): void {
    const entries = this.events.get(event);
    if (!entries) return;

    const index = entries.findIndex((e) => e.listener === listener);
    if (index >= 0) {
      entries.splice(index, 1);
    }
  }

  emit<T = unknown>(event: string, data?: T): void {
    const entries = this.events.get(event);
    if (!entries) return;

    const toRemove: EventEntry[] = [];

    for (const entry of entries) {
      try {
        entry.listener(data);
        if (entry.once) {
          toRemove.push(entry);
        }
      } catch (error) {
        console.error(`Error in event listener for ${event}:`, error);
      }
    }

    // Remove once listeners
    for (const entry of toRemove) {
      const index = entries.indexOf(entry);
      if (index >= 0) {
        entries.splice(index, 1);
      }
    }
  }

  removeAllListeners(event?: string): void {
    if (event) {
      this.events.delete(event);
    } else {
      this.events.clear();
    }
  }

  listenerCount(event: string): number {
    return this.events.get(event)?.length ?? 0;
  }

  eventNames(): string[] {
    return Array.from(this.events.keys());
  }
}

// Singleton instance
export const eventBus = new EventBus();

// Common events
export const EDITOR_EVENTS = {
  FILE_OPENED: 'editor:file-opened',
  FILE_SAVED: 'editor:file-saved',
  FILE_CLOSED: 'editor:file-closed',
  TAB_CHANGED: 'editor:tab-changed',
  CONTENT_CHANGED: 'editor:content-changed',
  CURSOR_CHANGED: 'editor:cursor-changed',
  SELECTION_CHANGED: 'editor:selection-changed',
} as const;

export const APP_EVENTS = {
  THEME_CHANGED: 'app:theme-changed',
  SETTINGS_CHANGED: 'app:settings-changed',
  WORKSPACE_CHANGED: 'app:workspace-changed',
  SIDEBAR_TOGGLED: 'app:sidebar-toggled',
  PANEL_TOGGLED: 'app:panel-toggled',
  COMMAND_EXECUTED: 'app:command-executed',
} as const;

export const GIT_EVENTS = {
  STATUS_CHANGED: 'git:status-changed',
  BRANCH_CHANGED: 'git:branch-changed',
  COMMIT_CREATED: 'git:commit-created',
} as const;

export const TERMINAL_EVENTS = {
  CREATED: 'terminal:created',
  CLOSED: 'terminal:closed',
  DATA_RECEIVED: 'terminal:data-received',
  TITLE_CHANGED: 'terminal:title-changed',
} as const;
