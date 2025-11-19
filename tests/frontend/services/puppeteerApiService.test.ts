import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFetch = vi.fn();
global.fetch = mockFetch;

const mockGetSession = vi.fn();
const mockGetCurrentUser = vi.fn();

vi.mock('amazon-cognito-identity-js', () => ({
  CognitoUserPool: vi.fn(() => ({ getCurrentUser: mockGetCurrentUser })),
}));

vi.mock('@/utils/connectionChangeTracker', () => ({
  connectionChangeTracker: {
    getCiphertextCredentials: vi.fn(() => 'mock-cipher'),
  },
}));

const { default: puppeteerApiService } = await import('@/services/puppeteerApiService');

describe('PuppeteerApiService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentUser.mockReturnValue({
      getSession: (cb: any) => cb(null, {
        isValid: () => true,
        getIdToken: () => ({ getJwtToken: () => 'mock-token' }),
      }),
    });
  });

  it('should perform LinkedIn search', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, data: { results: [] } }),
    });

    const result = await puppeteerApiService.search({ keywords: 'engineer' });
    expect(result.success).toBe(true);
  });

  it('should send LinkedIn message', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    });

    const result = await puppeteerApiService.sendMessage('conn-1', 'Hello');
    expect(result.success).toBe(true);
  });

  it('should handle network errors', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));
    const result = await puppeteerApiService.search({ keywords: 'test' });
    expect(result.success).toBe(false);
  });
});
