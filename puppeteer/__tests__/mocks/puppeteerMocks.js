import { vi } from 'vitest';

export const createMockElementHandle = (overrides = {}) => ({
  click: vi.fn().mockResolvedValue(undefined),
  type: vi.fn().mockResolvedValue(undefined),
  press: vi.fn().mockResolvedValue(undefined),
  focus: vi.fn().mockResolvedValue(undefined),
  hover: vi.fn().mockResolvedValue(undefined),
  boundingBox: vi.fn().mockResolvedValue({ x: 0, y: 0, width: 100, height: 50 }),
  screenshot: vi.fn().mockResolvedValue(Buffer.from('')),
  evaluate: vi.fn().mockResolvedValue(undefined),
  getProperty: vi.fn().mockResolvedValue({ jsonValue: vi.fn().mockResolvedValue('') }),
  $: vi.fn().mockResolvedValue(null),
  $$: vi.fn().mockResolvedValue([]),
  ...overrides,
});

export const createMockPage = (overrides = {}) => ({
  goto: vi.fn().mockResolvedValue({ status: vi.fn().mockReturnValue(200) }),
  waitForSelector: vi.fn().mockResolvedValue(createMockElementHandle()),
  waitForNavigation: vi.fn().mockResolvedValue(undefined),
  waitForTimeout: vi.fn().mockResolvedValue(undefined),
  waitForFunction: vi.fn().mockResolvedValue(undefined),
  click: vi.fn().mockResolvedValue(undefined),
  type: vi.fn().mockResolvedValue(undefined),
  keyboard: {
    press: vi.fn().mockResolvedValue(undefined),
    type: vi.fn().mockResolvedValue(undefined),
    down: vi.fn().mockResolvedValue(undefined),
    up: vi.fn().mockResolvedValue(undefined),
  },
  mouse: {
    click: vi.fn().mockResolvedValue(undefined),
    move: vi.fn().mockResolvedValue(undefined),
    wheel: vi.fn().mockResolvedValue(undefined),
  },
  evaluate: vi.fn().mockResolvedValue(undefined),
  evaluateHandle: vi.fn().mockResolvedValue({}),
  $: vi.fn().mockResolvedValue(createMockElementHandle()),
  $$: vi.fn().mockResolvedValue([]),
  $eval: vi.fn().mockResolvedValue(undefined),
  $$eval: vi.fn().mockResolvedValue([]),
  screenshot: vi.fn().mockResolvedValue(Buffer.from('')),
  pdf: vi.fn().mockResolvedValue(Buffer.from('')),
  content: vi.fn().mockResolvedValue('<html></html>'),
  url: vi.fn().mockReturnValue('https://example.com'),
  title: vi.fn().mockResolvedValue('Test Page'),
  setViewport: vi.fn().mockResolvedValue(undefined),
  setUserAgent: vi.fn().mockResolvedValue(undefined),
  setCookie: vi.fn().mockResolvedValue(undefined),
  cookies: vi.fn().mockResolvedValue([]),
  deleteCookie: vi.fn().mockResolvedValue(undefined),
  setExtraHTTPHeaders: vi.fn().mockResolvedValue(undefined),
  setRequestInterception: vi.fn().mockResolvedValue(undefined),
  on: vi.fn(),
  off: vi.fn(),
  once: vi.fn(),
  close: vi.fn().mockResolvedValue(undefined),
  isClosed: vi.fn().mockReturnValue(false),
  bringToFront: vi.fn().mockResolvedValue(undefined),
  reload: vi.fn().mockResolvedValue(undefined),
  goBack: vi.fn().mockResolvedValue(undefined),
  goForward: vi.fn().mockResolvedValue(undefined),
  ...overrides,
});

export const createMockBrowser = (overrides = {}) => {
  const mockPage = createMockPage();
  return {
    newPage: vi.fn().mockResolvedValue(mockPage),
    pages: vi.fn().mockResolvedValue([mockPage]),
    close: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn(),
    isConnected: vi.fn().mockReturnValue(true),
    process: vi.fn().mockReturnValue({ pid: 12345 }),
    version: vi.fn().mockResolvedValue('Chrome/120.0.0.0'),
    userAgent: vi.fn().mockResolvedValue('Mozilla/5.0'),
    wsEndpoint: vi.fn().mockReturnValue('ws://localhost:9222'),
    on: vi.fn(),
    off: vi.fn(),
    once: vi.fn(),
    ...overrides,
  };
};

export const createMockPuppeteer = (overrides = {}) => {
  const mockBrowser = createMockBrowser();
  return {
    launch: vi.fn().mockResolvedValue(mockBrowser),
    connect: vi.fn().mockResolvedValue(mockBrowser),
    defaultArgs: vi.fn().mockReturnValue([]),
    executablePath: vi.fn().mockReturnValue('/usr/bin/chromium'),
    ...overrides,
  };
};
