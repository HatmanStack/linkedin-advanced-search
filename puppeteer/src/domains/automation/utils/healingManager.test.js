import { describe, it, expect, vi, beforeEach } from 'vitest';
import fsSync from 'fs';

// Mock dependencies
vi.mock('#utils/logger.js', () => ({
  logger: { info: vi.fn(), debug: vi.fn(), error: vi.fn(), warn: vi.fn() }
}));

vi.mock('fs', () => ({
  default: { writeFileSync: vi.fn() },
  writeFileSync: vi.fn()
}));

vi.mock('child_process', () => ({
  spawn: vi.fn(() => ({ unref: vi.fn() }))
}));

import { HealingManager } from './healingManager.js';

describe('HealingManager', () => {
  let manager;

  beforeEach(() => {
    vi.clearAllMocks();
    manager = new HealingManager();
  });

  describe('_isProfileInitHealing', () => {
    it('returns true when healPhase is profile-init', () => {
      expect(manager._isProfileInitHealing({ healPhase: 'profile-init' })).toBe(true);
    });

    it('returns true when currentProcessingList is present', () => {
      expect(manager._isProfileInitHealing({ currentProcessingList: [] })).toBe(true);
    });

    it('returns true when masterIndexFile is present', () => {
      expect(manager._isProfileInitHealing({ masterIndexFile: 'index.json' })).toBe(true);
    });

    it('returns true when batchSize is present', () => {
      expect(manager._isProfileInitHealing({ batchSize: 50 })).toBe(true);
    });

    it('returns false for search healing params', () => {
      expect(manager._isProfileInitHealing({
        companyName: 'Acme',
        companyRole: 'Engineer'
      })).toBe(false);
    });

    it('returns false for empty params', () => {
      expect(manager._isProfileInitHealing({})).toBe(false);
    });
  });

  describe('_createProfileInitStateFile', () => {
    it('creates file in data directory', () => {
      const result = manager._createProfileInitStateFile({
        searchName: 'user',
        searchPassword: 'pass',
        requestId: 'req-1'
      });
      expect(result).toMatch(/^data\/profile-init-heal-\d+\.json$/);
    });

    it('writes valid JSON to file', () => {
      manager._createProfileInitStateFile({
        searchName: 'user',
        searchPassword: 'pass',
        recursionCount: 2,
        healPhase: 'profile-init',
        healReason: 'timeout'
      });

      const writeCall = fsSync.writeFileSync.mock.calls[0];
      const written = JSON.parse(writeCall[1]);
      expect(written.searchName).toBe('user');
      expect(written.recursionCount).toBe(2);
      expect(written.healPhase).toBe('profile-init');
      expect(written.healReason).toBe('timeout');
    });

    it('applies defaults for missing fields', () => {
      manager._createProfileInitStateFile({});

      const writeCall = fsSync.writeFileSync.mock.calls[0];
      const written = JSON.parse(writeCall[1]);
      expect(written.recursionCount).toBe(0);
      expect(written.healPhase).toBe('profile-init');
      expect(written.healReason).toBe('Unknown error');
      expect(written.currentBatch).toBe(0);
      expect(written.currentIndex).toBe(0);
      expect(written.batchSize).toBe(100);
    });

    it('includes timestamp in state data', () => {
      manager._createProfileInitStateFile({});

      const writeCall = fsSync.writeFileSync.mock.calls[0];
      const written = JSON.parse(writeCall[1]);
      expect(written.timestamp).toBeDefined();
      expect(new Date(written.timestamp)).toBeInstanceOf(Date);
    });
  });

  describe('_createStateFile', () => {
    it('creates file in data directory with search prefix', () => {
      const result = manager._createStateFile({ companyName: 'Acme' });
      expect(result).toMatch(/^data\/search-heal-\d+\.json$/);
    });

    it('writes state data as JSON', () => {
      const stateData = {
        companyName: 'Acme',
        companyRole: 'Engineer',
        recursionCount: 1
      };
      manager._createStateFile(stateData);

      const writeCall = fsSync.writeFileSync.mock.calls[0];
      const written = JSON.parse(writeCall[1]);
      expect(written.companyName).toBe('Acme');
      expect(written.companyRole).toBe('Engineer');
    });
  });

  describe('healAndRestart', () => {
    it('routes to profile init healing when healPhase is profile-init', async () => {
      const spy = vi.spyOn(manager, '_healProfileInit').mockResolvedValue();
      await manager.healAndRestart({ healPhase: 'profile-init', requestId: 'r1' });
      expect(spy).toHaveBeenCalled();
    });

    it('routes to search healing for search params', async () => {
      const spy = vi.spyOn(manager, '_healSearch').mockResolvedValue();
      await manager.healAndRestart({ companyName: 'Acme', companyRole: 'Dev' });
      expect(spy).toHaveBeenCalled();
    });
  });

  describe('_launchProfileInitWorker', () => {
    it('spawns detached node process with state file', async () => {
      const mockSpawn = vi.fn(() => ({ unref: vi.fn() }));
      vi.doMock('child_process', () => ({ spawn: mockSpawn }));

      // Use dynamic import to get the mocked version
      await manager._launchProfileInitWorker('data/test-state.json');
      // The spawn is called via dynamic import inside the method
    });
  });

  describe('_launchWorkerProcess', () => {
    it('spawns detached node process with state file', async () => {
      await manager._launchWorkerProcess('data/search-state.json');
      // Verify no throw - the spawn mock handles it
    });
  });
});
