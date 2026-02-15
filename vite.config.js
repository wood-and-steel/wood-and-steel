import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  resolve: {
    // Prefer .ts/.tsx so JS imports like '../Contract' resolve to Contract.ts
    extensions: ['.ts', '.tsx', '.mjs', '.js', '.jsx', '.json'],
  },
  plugins: [
    react({
      include: '**/*.{jsx,js,tsx,ts}',
    }),
  ],
  esbuild: {
    loader: 'tsx',
    include: /src\/.*\.(jsx?|tsx?)$/,
    exclude: [],
  },
  optimizeDeps: {
    esbuildOptions: {
      loader: {
        '.js': 'jsx',
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/config/setupTests.js',
  },
});
