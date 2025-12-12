import "@testing-library/jest-dom";
import { vi, afterEach, beforeAll } from "vitest";

// Mock Next.js modules
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}));

vi.mock("next/headers", () => ({
  headers: () => new Map(),
  cookies: () => ({
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
  }),
}));

vi.mock("next/image", () => ({
  default: (props: any) => props,
}));

// Mock Clerk authentication
vi.mock("@clerk/nextjs", () => ({
  useAuth: () => ({
    userId: "test-user-id",
    sessionId: "test-session-id",
    orgId: undefined,
    getToken: vi.fn(async () => "test-token"),
    signOut: vi.fn(),
    isLoaded: true,
    isSignedIn: true,
  }),
  useUser: () => ({
    user: {
      id: "test-user-id",
      email: "test@example.com",
      firstName: "Test",
      lastName: "User",
    },
    isLoaded: true,
  }),
  useClerk: () => ({
    signOut: vi.fn(),
  }),
}));

vi.mock("@clerk/nextjs/server", () => ({
  auth: () => ({
    userId: "test-user-id",
    sessionId: "test-session-id",
  }),
  currentUser: async () => ({
    id: "test-user-id",
    email: "test@example.com",
  }),
}));

// Mock @serwist/next
vi.mock("@serwist/next", () => ({
  default: (config: any) => (nextConfig: any) => ({
    ...nextConfig,
    ...config,
  }),
}));

// Global test utilities
global.fetch = vi.fn();

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  takeRecords() {
    return [];
  }
  unobserve() {}
} as any;

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
} as any;

// Mock window.matchMedia
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
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

// Mock sessionStorage
Object.defineProperty(window, "sessionStorage", {
  value: localStorageMock,
});

// Suppress console errors during tests (optional, comment out if you want to see them)
const originalError = console.error;
beforeAll(() => {
  console.error = (...args: any[]) => {
    if (
      typeof args[0] === "string" &&
      (args[0].includes("Warning: ReactDOM.render") ||
        args[0].includes("Not implemented: HTMLFormElement.prototype.submit") ||
        args[0].includes("Warning: useLayoutEffect"))
    ) {
      return;
    }
    originalError.call(console, ...args);
  };
});

// Cleanup after each test
afterEach(() => {
  vi.clearAllMocks();
  localStorageMock.clear();
});

// Global test helpers
export const createTestUser = (overrides = {}) => ({
  id: "test-user-id",
  email: "test@example.com",
  firstName: "Test",
  lastName: "User",
  ...overrides,
});

export const createTestAccount = (overrides = {}) => ({
  id: "test-account-id",
  name: "Test Account",
  type: "checking",
  balance: "1000.00",
  userId: "test-user-id",
  householdId: null,
  ...overrides,
});

export const createTestTransaction = (overrides = {}) => ({
  id: "test-transaction-id",
  description: "Test Transaction",
  amount: "100.00",
  type: "expense",
  category: "test-category",
  accountId: "test-account-id",
  userId: "test-user-id",
  date: new Date().toISOString(),
  notes: "",
  ...overrides,
});

export const createTestBudget = (overrides = {}) => ({
  id: "test-budget-id",
  category: "test-category",
  amount: "500.00",
  userId: "test-user-id",
  ...overrides,
});

export const createTestRule = (overrides = {}) => ({
  id: "test-rule-id",
  name: "Test Rule",
  priority: 1,
  conditions: {
    type: "and",
    conditions: [
      {
        field: "description",
        operator: "contains",
        value: "test",
      },
    ],
  },
  actions: {
    category: "test-category",
  },
  userId: "test-user-id",
  ...overrides,
});
