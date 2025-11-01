import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    globals: true,
    css: true,
  // Run tests in-process (no worker threads). This reduces child process
  // creation and can avoid worker OOMs seen in CI/local runs.
  // @ts-ignore: threads is an accepted option at runtime though not in types
  threads: false,
  // Reduce concurrency to avoid heavy parallel transforms which can trigger
  // out-of-memory conditions on low-RAM machines.
  maxConcurrency: 1,
    include: ['src/**/*.{test,spec}.ts', 'src/**/*.{test,spec}.tsx'],
    // Run tests in the main process (no worker pool) to avoid spawning
    // child processes which were previously exiting due to OOM.
    // Coverage configuration for Vitest - focus coverage on core logic (state + utils)
    coverage: {
      // Use the v8 provider to leverage Node's built-in coverage (no extra package required)
      provider: 'v8',
      // Output text summary, lcov (for CI/coveralls), and HTML report
      reporter: ['text', 'lcov', 'html'],
      // Put reports in the frontend coverage directory
      reportsDirectory: 'coverage',
      // Include all source files under `src` so coverage is collected across the whole app
      include: ['src/**/*.{ts,tsx}'],
      // Exclude only tests, fixtures, and type declarations
      exclude: [
        'src/**/__tests__/**',
        'src/**/?(*.){test,spec}.*',
        'src/data/**',
        'src/**/*.d.ts'
      ],
    // Collect coverage only for files imported by the tests. Setting `all: false`
    // reduces memory usage (avoids collecting coverage for large untested UI files)
    // and produces a coverage report reflecting actually executed code.
    all: false,
    },
  },
});