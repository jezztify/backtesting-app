import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    globals: true,
    css: true,
    include: ['src/**/*.{test,spec}.ts', 'src/**/*.{test,spec}.tsx'],
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
      // Collect coverage for all matched files (even if not imported during tests)
      all: true,
    },
  },
});