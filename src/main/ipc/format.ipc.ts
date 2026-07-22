/**
 * Format IPC - Prettier-based code formatting.
 * Prettier v3 is ESM-only; we use Function constructor to get a real dynamic import().
 */
import { ipcMain } from 'electron';

// Map Monaco language IDs to Prettier parser names
const langToParser: Record<string, string> = {
  javascript: 'babel',
  typescript: 'typescript',
  json: 'json',
  html: 'html',
  css: 'css',
  scss: 'scss',
  less: 'less',
  markdown: 'markdown',
  mdx: 'mdx',
  yaml: 'yaml',
  yml: 'yaml',
  graphql: 'graphql',
  plaintext: 'babel',
};

const extMap: Record<string, string> = {
  js: 'babel', jsx: 'babel', mjs: 'babel', cjs: 'babel',
  ts: 'typescript', tsx: 'typescript', mts: 'typescript',
  json: 'json', jsonc: 'json',
  html: 'html', htm: 'html',
  css: 'css', scss: 'scss', less: 'less',
  md: 'markdown', mdx: 'mdx',
  yml: 'yaml', yaml: 'yaml',
  graphql: 'graphql', gql: 'graphql',
};

function resolveParser(languageId: string, filePath: string): string {
  const fromId = langToParser[languageId];
  if (fromId) return fromId;
  if (filePath) {
    const ext = filePath.split('.').pop()?.toLowerCase();
    if (ext && extMap[ext]) return extMap[ext];
  }
  return 'babel';
}

// Real ESM dynamic import — bypasses CJS transpilation
const dynamicImport = new Function('specifier', 'return import(specifier)') as (s: string) => Promise<any>;

let prettierPromise: Promise<any> | null = null;
function getPrettier() {
  if (!prettierPromise) prettierPromise = dynamicImport('prettier');
  return prettierPromise;
}

ipcMain.handle('editor:format', async (_event, payload: { text: string; languageId: string; filePath: string }) => {
  try {
    const { text, languageId, filePath } = payload;
    if (!text || text.trim().length === 0) return text;

    const parser = resolveParser(languageId, filePath);
    const prettier = await getPrettier();

    const formatted: string = await prettier.format(text, {
      parser,
      filepath: filePath || undefined,
      singleQuote: true,
      trailingComma: 'all',
      tabWidth: 2,
      semi: true,
      printWidth: 100,
    });

    return formatted;
  } catch (err: any) {
    console.warn('[Format] Prettier failed, returning original text:', err?.message);
    return payload.text;
  }
});
