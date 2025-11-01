import '@testing-library/jest-dom/vitest';

// Minimal ResizeObserver polyfill for jsdom tests (used by Recharts ResponsiveContainer)
class ResizeObserverMock {
    observe() { }
    unobserve() { }
    disconnect() { }
}

// @ts-ignore - attach to global for tests
(global as any).ResizeObserver = (global as any).ResizeObserver || ResizeObserverMock;