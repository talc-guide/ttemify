import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const localEnv = mode === 'development' ? loadEnv(mode, '.', '') : {};

  return {
    plugins: [react(), tailwindcss()],
    define: mode === 'development'
      ? { 'import.meta.env.VITE_GEMINI_API_KEY': JSON.stringify(localEnv.GEMINI_API_KEY) }
      : {},
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR can be disabled via the DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
