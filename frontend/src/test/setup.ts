import "@testing-library/jest-dom";

// Suppress noisy warnings in tests
const originalWarn = console.warn;
const originalError = console.error;
console.warn = (...args: unknown[]) => {
  if (typeof args[0] === "string" && args[0].includes("React Router Future Flag Warning")) return;
  originalWarn(...args);
};
console.error = (...args: unknown[]) => {
  if (typeof args[0] === "string" && args[0].includes("not wrapped in act")) return;
  if (typeof args[0] === "string" && args[0].includes("width(0) and height(0)")) return;
  originalError(...args);
};

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = String(value);
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, "localStorage", {
  value: localStorageMock,
});

// Mock ResizeObserver for recharts
Object.defineProperty(global, "ResizeObserver", {
  writable: true,
  configurable: true,
  value: class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
});
