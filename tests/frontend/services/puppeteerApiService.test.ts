import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFetch = vi.fn();
global.fetch = mockFetch;

const mockGetCurrentUser = vi.fn();

vi.mock('amazon-cognito-identity-js', () => ({
  CognitoUserPool: vi.fn(() => ({ getCurrentUser: mockGetCurrentUser })),
}));

vi.mock('@/utils/connectionChangeTracker', () => ({
  connectionChangeTracker: {
    markChanged: vi.fn(),
  },
}));

// Mock sessionStorage with encrypted credentials
const mockSessionStorage = {
  getItem: vi.fn((key: string) => {
    if (key === 'li_credentials_ciphertext') {
      return 'sealbox_x25519:b64:bW9ja19lbmNyeXB0ZWRfZGF0YQ==';
    }
    return null;
  }),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  key: vi.fn(),
};

Object.defineProperty(window, 'sessionStorage', {
  value: mockSessionStorage,
  writable: true,
});

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
      headers: new Headers({ 'content-type': 'application/json' }),
      text: () => Promise.resolve(JSON.stringify({ success: true, data: { results: [] } })),
    });

    const result = await puppeteerApiService.searchLinkedIn({ keywords: 'engineer' } as any);
    expect(result.success).toBe(true);
  });

  it('should send LinkedIn message', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-type': 'application/json' }),
      text: () => Promise.resolve(JSON.stringify({ success: true, data: { messageId: 'msg-1', deliveryStatus: 'sent' } })),
    });

    const result = await puppeteerApiService.sendLinkedInMessage({
      recipientProfileId: 'profile-1',
      messageContent: 'Hello',
      recipientName: 'John Doe',
    });
    expect(result.success).toBe(true);
  });

  it('should handle network errors', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));
    const result = await puppeteerApiService.searchLinkedIn({ keywords: 'test' } as any);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Network error');
  });
});
