import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import type { Connection } from '@/types';

// Mock dependencies BEFORE importing hook
vi.mock('@/features/auth', () => ({
  useAuth: vi.fn(() => ({ user: { id: 'user-123' } }))
}));

vi.mock('@/shared/hooks', () => ({
  useToast: vi.fn(() => ({ toast: vi.fn() }))
}));

vi.mock('@/shared/services', () => ({
  lambdaApiService: {
    getConnectionsByStatus: vi.fn(() => Promise.resolve([]))
  },
  ApiError: class ApiError extends Error {}
}));

vi.mock('../utils/connectionCache', () => ({
  connectionCache: {
    setNamespace: vi.fn(),
    loadFromStorage: vi.fn(),
    getAll: vi.fn(() => []),
    setMultiple: vi.fn(),
    update: vi.fn()
  }
}));

vi.mock('../utils/connectionChangeTracker', () => ({
  connectionChangeTracker: {
    hasChanged: vi.fn(() => true),
    clearChanged: vi.fn()
  }
}));

vi.mock('@/shared/utils/logger', () => ({
  createLogger: () => ({ info: vi.fn(), error: vi.fn(), debug: vi.fn(), warn: vi.fn() })
}));

// Import hook AFTER mocks are set up
import { useConnectionsManager } from './useConnectionsManager';
import { useAuth } from '@/features/auth';
import { lambdaApiService } from '@/shared/services';
import { connectionCache } from '../utils/connectionCache';
import { connectionChangeTracker } from '../utils/connectionChangeTracker';

const mockUseAuth = useAuth as ReturnType<typeof vi.fn>;
const mockGetConnectionsByStatus = lambdaApiService.getConnectionsByStatus as ReturnType<typeof vi.fn>;

const mockConnections: Connection[] = [
  { id: '1', first_name: 'John', last_name: 'Doe', status: 'ally', tags: ['tech'] } as Connection,
  { id: '2', first_name: 'Jane', last_name: 'Smith', status: 'incoming', tags: ['design'] } as Connection,
  { id: '3', first_name: 'Bob', last_name: 'Wilson', status: 'outgoing', tags: ['tech'] } as Connection,
  { id: '4', first_name: 'Alice', last_name: 'Lee', status: 'possible', tags: [] } as Connection,
];

describe('useConnectionsManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({ user: { id: 'user-123' } });
    mockGetConnectionsByStatus.mockResolvedValue(mockConnections);
    vi.mocked(connectionChangeTracker.hasChanged).mockReturnValue(true);
    vi.mocked(connectionCache.getAll).mockReturnValue([]);
    sessionStorage.clear();
  });

  describe('initialization', () => {
    it('returns initial state before fetch', () => {
      vi.mocked(connectionChangeTracker.hasChanged).mockReturnValue(false);
      vi.mocked(connectionCache.getAll).mockReturnValue([]);

      const { result } = renderHook(() => useConnectionsManager());

      expect(result.current.selectedStatus).toBe('all');
      expect(result.current.activeTags).toEqual([]);
      expect(result.current.selectedConnections).toEqual([]);
    });

    it('fetches connections when change tracker indicates changes', async () => {
      const { result } = renderHook(() => useConnectionsManager());

      await waitFor(() => {
        expect(result.current.connectionsLoading).toBe(false);
      });

      expect(mockGetConnectionsByStatus).toHaveBeenCalled();
      expect(result.current.connections).toEqual(mockConnections);
    });

    it('does not fetch when user is null', () => {
      mockUseAuth.mockReturnValue({ user: null });

      renderHook(() => useConnectionsManager());

      expect(mockGetConnectionsByStatus).not.toHaveBeenCalled();
    });
  });

  describe('calculateConnectionCounts', () => {
    it('calculates counts by status', async () => {
      const { result } = renderHook(() => useConnectionsManager());

      await waitFor(() => {
        expect(result.current.connectionsLoading).toBe(false);
      });

      expect(result.current.connectionCounts).toEqual({
        incoming: 1,
        outgoing: 1,
        ally: 1,
        total: 3
      });
    });
  });

  describe('filteredConnections', () => {
    it('filters status=all to show incoming+outgoing+ally', async () => {
      const { result } = renderHook(() => useConnectionsManager());

      await waitFor(() => {
        expect(result.current.connections.length).toBeGreaterThan(0);
      });

      // 'possible' should be excluded from 'all'
      expect(result.current.filteredConnections.length).toBe(3);
      expect(result.current.filteredConnections.every(
        (c: Connection) => ['incoming', 'outgoing', 'ally'].includes(c.status)
      )).toBe(true);
    });

    it('filters by specific status', async () => {
      const { result } = renderHook(() => useConnectionsManager());

      await waitFor(() => {
        expect(result.current.connections.length).toBe(4);
      });

      act(() => {
        result.current.setSelectedStatus('ally');
      });

      expect(result.current.filteredConnections.length).toBe(1);
      expect(result.current.filteredConnections[0].id).toBe('1');
    });
  });

  describe('newConnections', () => {
    it('returns only possible status connections', async () => {
      const { result } = renderHook(() => useConnectionsManager());

      await waitFor(() => {
        expect(result.current.connections.length).toBe(4);
      });

      expect(result.current.newConnections.length).toBe(1);
      expect(result.current.newConnections[0].status).toBe('possible');
    });
  });

  describe('handleTagClick', () => {
    it('adds tag to activeTags', () => {
      const { result } = renderHook(() => useConnectionsManager());

      act(() => {
        result.current.handleTagClick('tech');
      });

      expect(result.current.activeTags).toContain('tech');
    });

    it('removes tag if already active', () => {
      const { result } = renderHook(() => useConnectionsManager());

      act(() => {
        result.current.handleTagClick('tech');
      });
      act(() => {
        result.current.handleTagClick('tech');
      });

      expect(result.current.activeTags).not.toContain('tech');
    });
  });

  describe('toggleConnectionSelection', () => {
    it('adds connection to selection', () => {
      const { result } = renderHook(() => useConnectionsManager());

      act(() => {
        result.current.toggleConnectionSelection('conn-1');
      });

      expect(result.current.selectedConnections).toContain('conn-1');
      expect(result.current.selectedConnectionsCount).toBe(1);
    });

    it('removes connection if already selected', () => {
      const { result } = renderHook(() => useConnectionsManager());

      act(() => {
        result.current.toggleConnectionSelection('conn-1');
      });
      act(() => {
        result.current.toggleConnectionSelection('conn-1');
      });

      expect(result.current.selectedConnections).not.toContain('conn-1');
    });
  });

  describe('updateConnectionStatus', () => {
    it('updates connection status in state', async () => {
      const { result } = renderHook(() => useConnectionsManager());

      await waitFor(() => {
        expect(result.current.connections.length).toBe(4);
      });

      act(() => {
        result.current.updateConnectionStatus('1', 'outgoing');
      });

      const updated = result.current.connections.find((c: Connection) => c.id === '1');
      expect(updated?.status).toBe('outgoing');
    });

    it('updates cache', async () => {
      const { result } = renderHook(() => useConnectionsManager());

      await waitFor(() => {
        expect(result.current.connections.length).toBe(4);
      });

      act(() => {
        result.current.updateConnectionStatus('1', 'outgoing');
      });

      expect(connectionCache.update).toHaveBeenCalledWith('1', { status: 'outgoing' });
    });
  });

  describe('fetchConnections', () => {
    it('handles fetch errors', async () => {
      mockGetConnectionsByStatus.mockRejectedValue(new Error('Network error'));
      vi.mocked(connectionChangeTracker.hasChanged).mockReturnValue(false);
      sessionStorage.setItem('connectionsInit:user-123', 'true');

      const { result } = renderHook(() => useConnectionsManager());

      await act(async () => {
        await result.current.fetchConnections();
      });

      expect(result.current.connectionsError).toBe('Failed to fetch connections');
    });
  });
});
