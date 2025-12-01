import { vi } from 'vitest';

export const createMockRequest = (overrides = {}) => ({
  body: {},
  params: {},
  query: {},
  headers: {},
  get: vi.fn((header) => overrides.headers?.[header] || null),
  ...overrides,
});

export const createMockResponse = () => {
  const res = {
    statusCode: 200,
    _json: null,
    _sent: false,
  };

  res.status = vi.fn((code) => {
    res.statusCode = code;
    return res;
  });

  res.json = vi.fn((data) => {
    res._json = data;
    res._sent = true;
    return res;
  });

  res.send = vi.fn((data) => {
    res._json = data;
    res._sent = true;
    return res;
  });

  res.end = vi.fn(() => {
    res._sent = true;
    return res;
  });

  res.set = vi.fn(() => res);
  res.setHeader = vi.fn(() => res);
  res.getHeader = vi.fn(() => null);

  return res;
};

export const createMockNext = () => vi.fn();

export const waitForMockCalls = async (mockFn, expectedCalls = 1, timeout = 5000) => {
  const startTime = Date.now();
  while (mockFn.mock.calls.length < expectedCalls) {
    if (Date.now() - startTime > timeout) {
      throw new Error(
        `Timeout waiting for ${expectedCalls} calls. Got ${mockFn.mock.calls.length}`
      );
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  return mockFn.mock.calls;
};

export const flushPromises = () => new Promise((resolve) => setImmediate(resolve));

export const mockEnvVars = (vars) => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    Object.assign(process.env, vars);
  });

  afterEach(() => {
    Object.keys(vars).forEach((key) => {
      if (originalEnv[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = originalEnv[key];
      }
    });
  });

  return originalEnv;
};

export const createMockLogger = () => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  verbose: vi.fn(),
  silly: vi.fn(),
});
