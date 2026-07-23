/**
 * Application Menu - Main process application menu.
 */
import { Menu, BrowserWindow, shell } from 'electron';
import type { MenuItemConstructorOptions } from 'electron';

export function createApplicationMenu(): Menu {
  const isMac = process.platform === 'darwin';

  const send = (channel: string) => {
    const win = BrowserWindow.getFocusedWindow();
    if (win) win.webContents.send(channel);
  };

  const template: MenuItemConstructorOptions[] = [
    // File menu
    {
      label: 'File',
      submenu: [
        { label: 'New File', accelerator: 'CmdOrCtrl+N', click: () => send('menu:file-new') },
        { label: 'Open File', accelerator: 'CmdOrCtrl+O', click: () => send('menu:file-open') },
        { label: 'Open Folder', accelerator: 'CmdOrCtrl+Shift+O', click: () => send('menu:folder-open') },
        { type: 'separator' },
        { label: 'Save', accelerator: 'CmdOrCtrl+S', click: () => send('menu:file-save') },
        { label: 'Save As', accelerator: 'CmdOrCtrl+Shift+S', click: () => send('menu:file-save-as') },
        { label: 'Save All', accelerator: 'CmdOrCtrl+K S', click: () => send('menu:file-save-all') },
        { type: 'separator' },
        { label: 'Preferences', accelerator: 'CmdOrCtrl+,', click: () => send('menu:open-settings') },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' },
      ],
    },

    // Edit menu
    {
      label: 'Edit',
      submenu: [
        { label: 'Undo', accelerator: 'CmdOrCtrl+Z', click: () => send('menu:undo') },
        { label: 'Redo', accelerator: 'CmdOrCtrl+Y', click: () => send('menu:redo') },
        { type: 'separator' },
        { label: 'Cut', accelerator: 'CmdOrCtrl+X', click: () => send('menu:cut') },
        { label: 'Copy', accelerator: 'CmdOrCtrl+C', click: () => send('menu:copy') },
        { label: 'Paste', accelerator: 'CmdOrCtrl+V', click: () => send('menu:paste') },
        { type: 'separator' },
        { label: 'Find', accelerator: 'CmdOrCtrl+F', click: () => send('menu:find') },
        { label: 'Replace', accelerator: 'CmdOrCtrl+H', click: () => send('menu:replace') },
        { type: 'separator' },
        { label: 'Select All', accelerator: 'CmdOrCtrl+A', click: () => send('menu:select-all') },
        { type: 'separator' },
        { label: 'Format Document', accelerator: 'Shift+Alt+F', click: () => send('menu:format-document') },
      ],
    },

    // View menu
    {
      label: 'View',
      submenu: [
        { label: 'Command Palette', accelerator: 'CmdOrCtrl+Shift+P', click: () => send('menu:command-palette') },
        { type: 'separator' },
        // Appearance
        { label: 'Sidebar', accelerator: 'CmdOrCtrl+B', click: () => send('menu:toggle-sidebar') },
        { label: 'Activity Bar', click: () => send('menu:toggle-activity-bar') },
        { label: 'Status Bar', click: () => send('menu:toggle-status-bar') },
        { label: 'Panel', accelerator: 'CmdOrCtrl+J', click: () => send('menu:toggle-panel') },
        { type: 'separator' },
        // Editor layout
        { label: 'Word Wrap', accelerator: 'Alt+Z', click: () => send('menu:toggle-word-wrap') },
        { label: 'Minimap', click: () => send('menu:toggle-minimap') },
        { label: 'Breadcrumbs', click: () => send('menu:toggle-breadcrumbs') },
        { label: 'Line Numbers', click: () => send('menu:toggle-line-numbers') },
        { label: 'Sticky Scroll', click: () => send('menu:toggle-sticky-scroll') },
        { type: 'separator' },
        // Terminal
        { label: 'Terminal', accelerator: 'CmdOrCtrl+`', click: () => send('menu:toggle-terminal') },
        { type: 'separator' },
        // Editor Layout submenu
        {
          label: 'Editor Layout',
          submenu: [
            { label: 'Split Up', click: () => send('menu:editor-layout-split-up') },
            { label: 'Split Down', click: () => send('menu:editor-layout-split-down') },
            { label: 'Split Left', click: () => send('menu:editor-layout-split-left') },
            { label: 'Split Right', click: () => send('menu:editor-layout-split-right') },
            { type: 'separator' },
            { label: 'Single Column', click: () => send('menu:editor-layout-single') },
            { label: 'Two Columns', click: () => send('menu:editor-layout-two-columns') },
          ],
        },
        { type: 'separator' },
        // Appearance submenu
        {
          label: 'Appearance',
          submenu: [
            { label: 'Full Screen', accelerator: 'F11', click: () => send('menu:toggle-fullscreen') },
            { label: 'Zen Mode', accelerator: 'CmdOrCtrl+K Z', click: () => send('menu:toggle-zen-mode') },
          ],
        },
        { type: 'separator' },
        // Developer
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        // Zoom
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
      ],
    },

    // Go menu
    {
      label: 'Go',
      submenu: [
        { label: 'Go to Line', accelerator: 'CmdOrCtrl+G', click: () => send('menu:go-to-line') },
        { label: 'Go to Symbol', accelerator: 'CmdOrCtrl+Shift+O', click: () => send('menu:go-to-symbol') },
        { type: 'separator' },
        { label: 'Go to Definition', accelerator: 'F12', click: () => send('menu:go-to-definition') },
        { label: 'Peek Definition', accelerator: 'Alt+F12', click: () => send('menu:peek-definition') },
        { type: 'separator' },
        { label: 'Back', accelerator: 'Alt+Left', click: () => send('menu:go-back') },
        { label: 'Forward', accelerator: 'Alt+Right', click: () => send('menu:go-forward') },
      ],
    },

    // Terminal menu
    {
      label: 'Terminal',
      submenu: [
        { label: 'New Terminal', accelerator: 'CmdOrCtrl+Shift+`', click: () => send('menu:new-terminal') },
        { label: 'Split Terminal', click: () => send('menu:split-terminal') },
        { type: 'separator' },
        { label: 'Kill Terminal', click: () => send('menu:kill-terminal') },
      ],
    },

    // Help menu
    {
      role: 'help',
      submenu: [
        {
          label: 'About Hypothesis',
          click: () => {
            const win = BrowserWindow.getAllWindows()[0];
            if (win) win.webContents.send('menu:about');
          },
        },
        {
          label: 'Check for Updates',
          click: () => {
            const win = BrowserWindow.getAllWindows()[0];
            if (win) win.webContents.send('menu:check-update');
          },
        },
        { type: 'separator' },
        { label: 'Documentation', click: () => shell.openExternal('https://github.com/hypothesis-editor/hypothesis') },
        { label: 'Report Issue', click: () => shell.openExternal('https://github.com/hypothesis-editor/hypothesis/issues') },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
  return menu;
}
