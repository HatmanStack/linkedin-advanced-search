import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
};
global.localStorage = mockLocalStorage as any;

const { healAndRestoreService } = await import('@/services/healAndRestoreService');

describe('HealAndRestoreService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should save workflow checkpoint', () => {
    const data = { step: 'test', progress: 50 };
    healAndRestoreService.saveCheckpoint('wf-1', data);
    expect(mockLocalStorage.setItem).toHaveBeenCalled();
  });

  it('should load workflow checkpoint', () => {
    mockLocalStorage.getItem.mockReturnValue(JSON.stringify({ step: 'test' }));
    const result = healAndRestoreService.loadCheckpoint('wf-1');
    expect(result?.step).toBe('test');
  });

  it('should clear checkpoint', () => {
    healAndRestoreService.clearCheckpoint('wf-1');
    expect(mockLocalStorage.removeItem).toHaveBeenCalled();
  });

  it('should return null for non-existent checkpoint', () => {
    mockLocalStorage.getItem.mockReturnValue(null);
    const result = healAndRestoreService.loadCheckpoint('wf-999');
    expect(result).toBeNull();
  });

  it('should handle malformed JSON', () => {
    mockLocalStorage.getItem.mockReturnValue('invalid-json{');
    const result = healAndRestoreService.loadCheckpoint('wf-1');
    expect(result).toBeNull();
  });
});
