import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSessionStorage = {
  getItem: vi.fn(),
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

vi.mock('@/services/puppeteerApiService', () => ({
  puppeteerApiService: {
    authorizeHealAndRestore: vi.fn().mockResolvedValue({ success: true }),
    cancelHealAndRestore: vi.fn().mockResolvedValue({ success: true }),
    checkHealAndRestoreStatus: vi.fn().mockResolvedValue({ success: true, data: {} }),
  },
}));

const { healAndRestoreService } = await import('@/services/healAndRestoreService');

describe('HealAndRestoreService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should check if auto-approve is enabled', () => {
    mockSessionStorage.getItem.mockReturnValue('true');
    const result = healAndRestoreService.isAutoApproveEnabled();
    expect(result).toBe(true);
    expect(mockSessionStorage.getItem).toHaveBeenCalledWith('autoApproveHealRestore');
  });

  it('should set auto-approve preference', () => {
    healAndRestoreService.setAutoApprove(true);
    expect(mockSessionStorage.setItem).toHaveBeenCalledWith('autoApproveHealRestore', 'true');
  });

  it('should remove auto-approve when disabled', () => {
    healAndRestoreService.setAutoApprove(false);
    expect(mockSessionStorage.removeItem).toHaveBeenCalledWith('autoApproveHealRestore');
  });

  it('should authorize heal and restore', async () => {
    const result = await healAndRestoreService.authorizeHealAndRestore('session-1', false);
    expect(result).toBe(true);
  });

  it('should cancel heal and restore', async () => {
    const result = await healAndRestoreService.cancelHealAndRestore('session-1');
    expect(result).toBe(true);
  });
});
