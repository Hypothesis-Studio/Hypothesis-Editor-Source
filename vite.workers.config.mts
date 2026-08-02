import { defineConfig } from 'vite';
import path from 'path';

// Separate Vite build config for Monaco Editor workers.
// Workers must be self-contained bundles — they cannot share chunks with the main app.
// Running as a separate build ensures each worker is fully bundled with all dependencies.
export default defineConfig({
  build: {
    outDir: 'dist/renderer/workers',
    emptyOutDir: false,
    chunkSizeWarningLimit: 15000,
    rollupOptions: {
      input: {
        'editor.worker': path.resolve(__dirname, 'src/workers/editor.worker.ts'),
        'json.worker': path.resolve(__dirname, 'src/workers/json.worker.ts'),
        'html.worker': path.resolve(__dirname, 'src/workers/html.worker.ts'),
        'css.worker': path.resolve(__dirname, 'src/workers/css.worker.ts'),
        'ts.worker': path.resolve(__dirname, 'src/workers/ts.worker.ts'),
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: '[name]-[hash].js',
        // Each worker must be inlined — no code splitting between workers
        inlineDynamicImports: false,
      },
    },
  },
});
