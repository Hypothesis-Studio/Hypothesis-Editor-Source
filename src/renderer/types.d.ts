/**
 * Global type declarations for Hypothesis Editor renderer.
 */
/// <reference types="vite/client" />

interface Window {
  api: {
    app: {
      getVersion(): Promise<string>;
      quit(): Promise<void>;
      relaunch(): Promise<void>;
      onFocus(callback: () => void): () => void;
    };
    window: {
      close(): Promise<void>;
      minimize(): Promise<void>;
      maximize(): Promise<void>;
      restore(): Promise<void>;
      isMaximized(): Promise<boolean>;
      setTitle(title: string): Promise<void>;
      newWindow(): Promise<void>;
      getAll(): Promise<Array<{ id: number; title: string; isFocused: boolean; isMaximized: boolean; isMinimized: boolean }>>;
    };
    file: {
      open(): Promise<Array<{ filePath: string; content: string }> | null>;
      save(filePath: string, content: string): Promise<boolean>;
      saveAs(content: string): Promise<string | null>;
      read(filePath: string): Promise<string>;
      exists(filePath: string): Promise<boolean>;
      create(filePath: string, content?: string): Promise<boolean>;
      delete(filePath: string): Promise<boolean>;
      rename(oldPath: string, newPath: string): Promise<boolean>;
      copy(source: string, destination: string): Promise<boolean>;
      move(source: string, destination: string): Promise<boolean>;
      stat(filePath: string): Promise<{ size: number; createdAt: Date; modifiedAt: Date; isDirectory: boolean; isFile: boolean; isSymlink: boolean }>;
      dialogOpen(options: unknown): Promise<{ canceled: boolean; filePaths: string[] }>;
      dialogSave(options: unknown): Promise<{ canceled: boolean; filePath?: string }>;
      revealInFileManager(filePath: string): Promise<boolean>;
      openInTerminal(dirPath: string): Promise<boolean>;
    };
    directory: {
      read(dirPath: string): Promise<Array<{ name: string; path: string; type: 'file' | 'directory' | 'symlink'; size: number; modifiedAt: Date; createdAt: Date; isHidden: boolean; extension: string; depth: number }>>;
      create(dirPath: string): Promise<boolean>;
      tree(dirPath: string, depth?: number): Promise<unknown[]>;
    };
    terminal: {
      create(options?: { shell?: string; cwd?: string; name?: string }): Promise<{ id: string; name: string; shell: string; cwd: string; pid: number; isActive: boolean; title: string; rows: number; cols: number; createdAt: number } | null>;
      write(id: string, data: string): void;
      resize(id: string, cols: number, rows: number): Promise<boolean>;
      close(id: string): Promise<boolean>;
      kill(id: string): Promise<boolean>;
      list(): Promise<Array<{ id: string; name: string; shell: string; cwd: string; pid: number; isActive: boolean; title: string; rows: number; cols: number; createdAt: number }>>;
      onData(callback: (data: { id: string; data: string }) => void): () => void;
      onExit(callback: (data: { id: string; exitCode: number; signal: number }) => void): () => void;
      onTitle(callback: (data: { id: string; title: string }) => void): () => void;
    };
    git: {
      status(repoPath: string): Promise<unknown>;
      commit(repoPath: string, message: string, files?: string[]): Promise<string>;
      push(repoPath: string, remote?: string): Promise<string>;
      pull(repoPath: string, remote?: string): Promise<string>;
      fetch(repoPath: string, remote?: string): Promise<string>;
      clone(url: string, destination: string): Promise<string>;
      branch(repoPath: string): Promise<unknown[]>;
      checkout(repoPath: string, branch: string): Promise<string>;
      merge(repoPath: string, branch: string): Promise<string>;
      diff(repoPath: string, file?: string): Promise<string>;
      log(repoPath: string, maxCount?: number): Promise<unknown[]>;
      stash(repoPath: string): Promise<string>;
      add(repoPath: string, files: string[]): Promise<string>;
      reset(repoPath: string, files?: string[]): Promise<string>;
      init(repoPath: string): Promise<string>;
      discardFile(repoPath: string, file: string): Promise<string>;
      discardAll(repoPath: string): Promise<string>;
      isGitRepo(repoPath: string): Promise<boolean>;
    };
    settings: {
      get<T>(key: string): Promise<T>;
      set(key: string, value: unknown): Promise<boolean>;
      getAll(): Promise<Record<string, unknown>>;
      reset(key?: string): Promise<boolean>;
      export(): Promise<string>;
      import(data: string): Promise<boolean>;
      onChanged(callback: (settings: Record<string, unknown>) => void): () => void;
    };
    theme: {
      get(): Promise<unknown>;
      set(themeId: string): Promise<boolean>;
      list(): Promise<unknown[]>;
      onChanged(callback: (theme: unknown) => void): () => void;
    };
    plugin: {
      list(): Promise<unknown[]>;
      install(pluginPath: string): Promise<unknown>;
      uninstall(pluginId: string): Promise<void>;
      enable(pluginId: string): Promise<void>;
      disable(pluginId: string): Promise<void>;
      activate(pluginId: string): Promise<void>;
      installHyp(hypPath: string): Promise<unknown>;
      pack(folderPath: string, outputPath?: string): Promise<string>;
      getExtensionCommands(): Promise<Array<{ id: string; label: string; category: string; pluginId: string }>>;
      executeCommand(commandId: string, args?: unknown): Promise<unknown>;
    };
    search: {
      find(options: unknown): Promise<unknown>;
      replace(options: unknown): Promise<unknown>;
      replaceAll(options: unknown): Promise<unknown>;
    };
    clipboard: {
      read(): Promise<string>;
      write(text: string): Promise<void>;
      history(): Promise<string[]>;
    };
    update: {
      check(): Promise<unknown>;
      download(): Promise<void>;
      install(): Promise<void>;
      onAvailable(callback: (info: unknown) => void): () => void;
      onDownloaded(callback: (info: unknown) => void): () => void;
      onProgress(callback: (progress: unknown) => void): () => void;
    };
    dialog: {
      message(options: unknown): Promise<unknown>;
      confirm(options: unknown): Promise<unknown>;
      input(options: unknown): Promise<unknown>;
    };
    menu: {
      popupContext(menuId: string): Promise<void>;
      setMenu(menuId: string): Promise<void>;
      /** Listen for a menu IPC channel sent from main process. Returns unsubscribe function. */
      onChannel(channel: string, callback: () => void): () => void;
    };
    crash: {
      report(report: unknown): Promise<void>;
      recovery(): Promise<void>;
    };
    log: {
      info(message: string, ...args: unknown[]): void;
      warn(message: string, ...args: unknown[]): void;
      error(message: string, ...args: unknown[]): void;
      debug(message: string, ...args: unknown[]): void;
    };
    agent: {
      chat: {
        send(sessionId: string, content: string, agentId?: string, workspacePath?: string, workspaceFolders?: string[]): Promise<{ success: boolean; data?: unknown; error?: string }>;
        stream(sessionId: string, content: string, agentId?: string, workspacePath?: string, workspaceFolders?: string[]): Promise<{ success: boolean; error?: string }>;
        cancel(sessionId: string): Promise<{ success: boolean; error?: string }>;
        history(sessionId: string): Promise<{ success: boolean; data?: unknown[]; error?: string }>;
      };
      session: {
        create(agentId: string, title?: string): Promise<{ success: boolean; data?: unknown; error?: string }>;
        list(agentId?: string, limit?: number): Promise<{ success: boolean; data?: unknown[]; error?: string }>;
        delete(sessionId: string): Promise<{ success: boolean; error?: string }>;
        get(sessionId: string): Promise<{ success: boolean; data?: unknown; error?: string }>;
      };
      provider: {
        list(): Promise<{ success: boolean; data?: unknown[]; error?: string }>;
        add(config: unknown): Promise<{ success: boolean; data?: unknown; error?: string }>;
        update(id: string, updates: unknown): Promise<{ success: boolean; data?: unknown; error?: string }>;
        remove(id: string): Promise<{ success: boolean; error?: string }>;
        test(id: string): Promise<{ success: boolean; data?: unknown; error?: string }>;
        models(id: string): Promise<{ success: boolean; data?: unknown[]; error?: string }>;
      };
      config: {
        list(): Promise<{ success: boolean; data?: unknown[]; error?: string }>;
        get(id: string): Promise<{ success: boolean; data?: unknown; error?: string }>;
        create(config: unknown): Promise<{ success: boolean; data?: unknown; error?: string }>;
        update(id: string, updates: unknown): Promise<{ success: boolean; data?: unknown; error?: string }>;
        delete(id: string): Promise<{ success: boolean; error?: string }>;
      };
      task: {
        list(filters?: unknown): Promise<{ success: boolean; data?: unknown[]; error?: string }>;
        get(id: string): Promise<{ success: boolean; data?: unknown; error?: string }>;
        cancel(id: string): Promise<{ success: boolean; error?: string }>;
        delete(id: string): Promise<{ success: boolean; error?: string }>;
      };
      tool: {
        list(): Promise<{ success: boolean; data?: unknown[]; error?: string }>;
        enable(id: string): Promise<{ success: boolean; error?: string }>;
        disable(id: string): Promise<{ success: boolean; error?: string }>;
      };
      memory: {
        search(query: unknown): Promise<{ success: boolean; data?: unknown[]; error?: string }>;
        list(limit?: number): Promise<{ success: boolean; data?: unknown[]; error?: string }>;
        clear(sessionId?: string): Promise<{ success: boolean; error?: string }>;
      };
      log: {
        list(filters?: unknown): Promise<{ success: boolean; data?: unknown[]; error?: string }>;
        clear(): Promise<{ success: boolean; error?: string }>;
      };
      status(): Promise<{ success: boolean; data?: unknown; error?: string }>;
      stream: {
        onEvent(callback: (event: unknown) => void): () => void;
        onEnd(callback: (data: unknown) => void): () => void;
      };
      onLogEntry(callback: (entry: unknown) => void): () => void;
    };
    insights: {
      scanProject(projectPath: string): Promise<{ success: boolean; data?: unknown; error?: string }>;
      getCached(projectPath: string): Promise<{ success: boolean; data?: unknown; error?: string }>;
      clearCache(projectPath?: string): Promise<{ success: boolean; error?: string }>;
      runAudit(projectPath: string): Promise<{ success: boolean; data?: unknown; error?: string }>;
      checkOutdated(projectPath: string): Promise<{ success: boolean; data?: unknown; error?: string }>;
      findDuplicates(projectPath: string): Promise<{ success: boolean; data?: unknown; error?: string }>;
      onProgress(callback: (progress: { phase: string; progress: number; message: string }) => void): () => void;
    };
    preview: {
      loadPreview(filePath: string): Promise<{ success: boolean; data?: unknown; error?: string }>;
      renderMarkdown(markdown: string): Promise<{ success: boolean; data?: string; error?: string }>;
      getFileType(ext: string): Promise<{ success: boolean; data?: { category: string; isPreviewable: boolean }; error?: string }>;
      watchFile(filePath: string): Promise<{ success: boolean; error?: string }>;
      unwatchFile(filePath: string): Promise<{ success: boolean; error?: string }>;
      onFileChanged(callback: (data: { filePath: string }) => void): () => void;
    };
  };
}
