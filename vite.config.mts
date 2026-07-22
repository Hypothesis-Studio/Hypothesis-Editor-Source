import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  root: '.',
  base: './',
  build: {
    outDir: 'dist/renderer',
    emptyOutDir: true,
    chunkSizeWarningLimit: 500,
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
      },
      output: {
        manualChunks: {
          'monaco-editor': ['monaco-editor'],
          'react-vendor': ['react', 'react-dom'],
          'xterm': ['@xterm/xterm'],
          'zustand': ['zustand'],
        },
      },
    },
  },
  resolve: {
    alias: {
      '@renderer': path.resolve(__dirname, 'src/renderer'),
      '@shared': path.resolve(__dirname, 'src/shared'),
      '@components': path.resolve(__dirname, 'src/renderer/components'),
      '@hooks': path.resolve(__dirname, 'src/renderer/hooks'),
      '@stores': path.resolve(__dirname, 'src/renderer/stores'),
      '@services': path.resolve(__dirname, 'src/renderer/services'),
      '@themes': path.resolve(__dirname, 'src/renderer/themes'),
      '@utils': path.resolve(__dirname, 'src/renderer/utils'),
      '@layouts': path.resolve(__dirname, 'src/renderer/layouts'),
      '@pages': path.resolve(__dirname, 'src/renderer/pages'),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
});
