/**
 * Theme Definitions - Built-in theme registry for the renderer.
 * These correspond to the themes in ThemeService but are used for Monaco Editor and CSS.
 */
// @ts-ignore - Partial theme definition for renderer
export interface RendererThemeColors {
  [key: string]: string;
}

export interface ThemeDefinition {
  id: string;
  name: string;
  type: 'dark' | 'light' | 'high-contrast';
  isBuiltin: boolean;
  semanticHighlighting: boolean;
  colors: RendererThemeColors;
  tokenColors: Array<{ scope: string | string[]; settings: { foreground?: string; fontStyle?: string } }>;
}

export const builtinThemes: ThemeDefinition[] = [
  {
    id: 'hypothesis-dark',
    name: 'Hypothesis Dark',
    type: 'dark',
    isBuiltin: true,
    semanticHighlighting: true,
    colors: {
      'editor.background': '#1e1e1e',
      'editor.foreground': '#d4d4d4',
      'editorCursor.foreground': '#aeafad',
      'editorLineNumber.foreground': '#858585',
      'editorLineNumber.activeForeground': '#c6c6c6',
      'editor.selectionBackground': '#264f78',
      'editor.inactiveSelectionBackground': '#3a3d41',
      'editor.lineHighlightBackground': '#2a2d2e',
      'editorIndentGuide.background': '#404040',
      'editorIndentGuide.activeBackground': '#707070',
      'editorBracketMatch.background': '#0064001a',
      'editorBracketMatch.border': '#888888',
      'sideBar.background': '#252526',
      'sideBar.foreground': '#cccccc',
      'activityBar.background': '#333333',
      'activityBar.foreground': '#ffffff',
      'statusBar.background': '#007acc',
      'statusBar.foreground': '#ffffff',
      'tab.activeBackground': '#1e1e1e',
      'tab.activeForeground': '#ffffff',
      'tab.inactiveBackground': '#2d2d2d',
      'tab.inactiveForeground': '#858585',
      'terminal.background': '#1e1e1e',
      'terminal.foreground': '#cccccc',
    },
    tokenColors: [
      { scope: 'comment', settings: { foreground: '#6a9955', fontStyle: 'italic' } },
      { scope: 'keyword', settings: { foreground: '#569cd6' } },
      { scope: 'string', settings: { foreground: '#ce9178' } },
      { scope: 'number', settings: { foreground: '#b5cea8' } },
      { scope: 'type', settings: { foreground: '#4ec9b0' } },
      { scope: 'function', settings: { foreground: '#dcdcaa' } },
      { scope: 'variable', settings: { foreground: '#9cdcfe' } },
    ],
  },
  {
    id: 'hypothesis-light',
    name: 'Hypothesis Light',
    type: 'light',
    isBuiltin: true,
    semanticHighlighting: true,
    colors: {
      'editor.background': '#ffffff',
      'editor.foreground': '#333333',
      'editorCursor.foreground': '#000000',
      'editorLineNumber.foreground': '#237893',
      'editorLineNumber.activeForeground': '#0b216f',
      'editor.selectionBackground': '#add6ff',
      'editor.lineHighlightBackground': '#f5f5f5',
      'editorIndentGuide.background': '#d3d3d3',
      'sideBar.background': '#f3f3f3',
      'sideBar.foreground': '#616161',
      'activityBar.background': '#2c2c2c',
      'activityBar.foreground': '#ffffff',
      'statusBar.background': '#007acc',
      'statusBar.foreground': '#ffffff',
      'tab.activeBackground': '#ffffff',
      'tab.activeForeground': '#333333',
      'tab.inactiveBackground': '#ececec',
      'tab.inactiveForeground': '#858585',
      'terminal.background': '#ffffff',
      'terminal.foreground': '#333333',
    },
    tokenColors: [
      { scope: 'comment', settings: { foreground: '#008000', fontStyle: 'italic' } },
      { scope: 'keyword', settings: { foreground: '#0000ff' } },
      { scope: 'string', settings: { foreground: '#a31515' } },
      { scope: 'number', settings: { foreground: '#098658' } },
      { scope: 'type', settings: { foreground: '#267f99' } },
      { scope: 'function', settings: { foreground: '#795e26' } },
      { scope: 'variable', settings: { foreground: '#001080' } },
    ],
  },
];

export function getThemeById(id: string): ThemeDefinition | undefined {
  return builtinThemes.find((t) => t.id === id);
}

export function getMonacoTheme(themeId: string): object {
  const theme = getThemeById(themeId);
  if (!theme) return {};

  return {
    base: theme.type === 'light' ? 'vs' : 'vs-dark',
    inherit: true,
    rules: theme.tokenColors.map((tc) => ({
      token: Array.isArray(tc.scope) ? tc.scope[0] : tc.scope,
      foreground: tc.settings.foreground?.replace('#', ''),
      fontStyle: tc.settings.fontStyle,
    })),
    colors: theme.colors,
  };
}
