/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base: './' so the built bundle works from any path: a GitHub Pages project
// subdirectory, a bare S3 bucket, or a folder someone unzipped. A demo that
// only loads from the one URL it was built for is a demo that breaks in transit.
export default defineConfig({
  base: './',
  plugins: [react()],
  build: { outDir: 'dist', sourcemap: false },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
