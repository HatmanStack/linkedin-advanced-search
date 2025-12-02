import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';

// Mock modules must be at top level before imports
const mockGetConnections = vi.fn();
const mockCreateConnection = vi.fn();
const mockUpdateConnection = vi.fn();
const mockUser = { id: 'user-1', email: 'test@example.com' };
const mockUseAuth = vi.fn(() => ({ user: mockUser, isLoading: false }));

vi.mock('@/features/auth', () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock('@/shared/services', () => ({
  puppeteerApiService: {
    getConnections: (...args: unknown[]) => mockGetConnections(...args),
    createConnection: (...args: unknown[]) => mockCreateConnection(...args),
    updateConnection: (...args: unknown[]) => mockUpdateConnection(...args),
  },
}));

// Import after mocks
import { useConnections } from '@/features/connections/hooks/useConnections';
import { createMockConnection, resetFactoryCounters } from '../../utils/mockFactories';

describe('useConnections', () => {
  beforeEach(() => {
    resetFactoryCounters();
    mockGetConnections.mockReset();
    mockCreateConnection.mockReset();
    mockUpdateConnection.mockReset();
    mockUseAuth.mockReturnValue({ user: mockUser, isLoading: false });

    // Default successful response
    mockGetConnections.mockResolvedValue({
      success: true,
      data: { connections: [] },
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('initial state', () => {
    it('starts with loading true', async () => {
      const { result } = renderHook(() => useConnections());

      // Initial state should be loading
      expect(result.current.loading).toBe(true);

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
    });

    it('starts with empty connections array', async () => {
      const { result } = renderHook(() => useConnections());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Connections should be populated after fetch
      expect(Array.isArray(result.current.connections)).toBe(true);
    });

    it('starts with null error', async () => {
      const { result } = renderHook(() => useConnections());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBeNull();
    });
  });

  describe('fetching connections', () => {
    it('fetches connections on mount', async () => {
      mockGetConnections.mockResolvedValueOnce({
        success: true,
        data: {
          connections: [
            createMockConnection({ first_name: 'John', last_name: 'Doe' }),
            createMockConnection({ first_name: 'Jane', last_name: 'Smith' }),
          ],
        },
      });

      const { result } = renderHook(() => useConnections());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(mockGetConnections).toHaveBeenCalled();
      expect(result.current.connections).toHaveLength(2);
      expect(result.current.connections[0].first_name).toBe('John');
    });

    it('passes filters to API call', async () => {
      const filters = { status: 'ally', tags: ['developer'] };

      mockGetConnections.mockResolvedValueOnce({
        success: true,
        data: { connections: [] },
      });

      renderHook(() => useConnections(filters));

      await waitFor(() => {
        expect(mockGetConnections).toHaveBeenCalledWith(filters);
      });
    });

    it('sets error on failed fetch', async () => {
      mockGetConnections.mockResolvedValueOnce({
        success: false,
        error: 'Server error',
      });

      const { result } = renderHook(() => useConnections());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBe('Server error');
      expect(result.current.connections).toEqual([]);
    });

    it('handles missing error message in response', async () => {
      mockGetConnections.mockResolvedValueOnce({
        success: false,
      });

      const { result } = renderHook(() => useConnections());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBe('Failed to fetch connections');
    });

    it('handles network errors', async () => {
      mockGetConnections.mockRejectedValueOnce(
        new Error('Network error')
      );

      const { result } = renderHook(() => useConnections());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBe('Network error');
      expect(result.current.connections).toEqual([]);
    });

    it('handles non-Error thrown values', async () => {
      mockGetConnections.mockRejectedValueOnce('string error');

      const { result } = renderHook(() => useConnections());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBe('Unknown error');
    });

    it('handles empty connections array in response', async () => {
      mockGetConnections.mockResolvedValueOnce({
        success: true,
        data: { connections: [] },
      });

      const { result } = renderHook(() => useConnections());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.connections).toEqual([]);
      expect(result.current.error).toBeNull();
    });

    it('handles missing connections key in response data', async () => {
      mockGetConnections.mockResolvedValueOnce({
        success: true,
        data: {},
      });

      const { result } = renderHook(() => useConnections());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.connections).toEqual([]);
    });
  });

  describe('refetch', () => {
    it('provides refetch function', async () => {
      const { result } = renderHook(() => useConnections());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(typeof result.current.refetch).toBe('function');
    });

    it('refetch triggers new API call', async () => {
      mockGetConnections.mockResolvedValue({
        success: true,
        data: { connections: [] },
      });

      const { result } = renderHook(() => useConnections());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Clear the mock to count only refetch calls
      mockGetConnections.mockClear();

      mockGetConnections.mockResolvedValueOnce({
        success: true,
        data: {
          connections: [createMockConnection({ first_name: 'New' })],
        },
      });

      await act(async () => {
        await result.current.refetch();
      });

      expect(mockGetConnections).toHaveBeenCalledTimes(1);
      expect(result.current.connections).toHaveLength(1);
      expect(result.current.connections[0].first_name).toBe('New');
    });

    it('refetch clears previous error', async () => {
      mockGetConnections.mockResolvedValueOnce({
        success: false,
        error: 'Initial error',
      });

      const { result } = renderHook(() => useConnections());

      await waitFor(() => {
        expect(result.current.error).toBe('Initial error');
      });

      mockGetConnections.mockResolvedValueOnce({
        success: true,
        data: { connections: [] },
      });

      await act(async () => {
        await result.current.refetch();
      });

      expect(result.current.error).toBeNull();
    });
  });

  describe('createConnection', () => {
    it('creates a connection and adds to list', async () => {
      const newConnection = createMockConnection({ first_name: 'New' });

      mockGetConnections.mockResolvedValueOnce({
        success: true,
        data: { connections: [] },
      });

      mockCreateConnection.mockResolvedValueOnce({
        success: true,
        data: newConnection,
      });

      const { result } = renderHook(() => useConnections());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      let success: boolean = false;
      await act(async () => {
        success = await result.current.createConnection({ first_name: 'New' });
      });

      expect(success).toBe(true);
      expect(result.current.connections).toHaveLength(1);
      expect(result.current.connections[0].first_name).toBe('New');
    });

    it('returns false on create failure', async () => {
      mockGetConnections.mockResolvedValueOnce({
        success: true,
        data: { connections: [] },
      });

      mockCreateConnection.mockResolvedValueOnce({
        success: false,
        error: 'Create failed',
      });

      const { result } = renderHook(() => useConnections());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      let success: boolean = false;
      await act(async () => {
        success = await result.current.createConnection({ first_name: 'New' });
      });

      expect(success).toBe(false);
      expect(result.current.error).toBe('Create failed');
    });

    it('handles create network error', async () => {
      mockGetConnections.mockResolvedValueOnce({
        success: true,
        data: { connections: [] },
      });

      mockCreateConnection.mockRejectedValueOnce(
        new Error('Network error')
      );

      const { result } = renderHook(() => useConnections());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      let success: boolean = false;
      await act(async () => {
        success = await result.current.createConnection({ first_name: 'New' });
      });

      expect(success).toBe(false);
      expect(result.current.error).toBe('Network error');
    });
  });

  describe('updateConnection', () => {
    it('updates a connection in the list', async () => {
      const existingConnection = {
        ...createMockConnection({ first_name: 'Original' }),
        connection_id: 'conn-1',
      };

      mockGetConnections.mockResolvedValueOnce({
        success: true,
        data: { connections: [existingConnection] },
      });

      mockUpdateConnection.mockResolvedValueOnce({
        success: true,
        data: { first_name: 'Updated' },
      });

      const { result } = renderHook(() => useConnections());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      let success: boolean = false;
      await act(async () => {
        success = await result.current.updateConnection('conn-1', { first_name: 'Updated' });
      });

      expect(success).toBe(true);
      expect(result.current.connections[0].first_name).toBe('Updated');
    });

    it('returns false on update failure', async () => {
      mockGetConnections.mockResolvedValueOnce({
        success: true,
        data: { connections: [] },
      });

      mockUpdateConnection.mockResolvedValueOnce({
        success: false,
        error: 'Update failed',
      });

      const { result } = renderHook(() => useConnections());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      let success: boolean = false;
      await act(async () => {
        success = await result.current.updateConnection('conn-1', { first_name: 'Updated' });
      });

      expect(success).toBe(false);
      expect(result.current.error).toBe('Update failed');
    });

    it('handles update network error', async () => {
      mockGetConnections.mockResolvedValueOnce({
        success: true,
        data: { connections: [] },
      });

      mockUpdateConnection.mockRejectedValueOnce(
        new Error('Network error')
      );

      const { result } = renderHook(() => useConnections());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      let success: boolean = false;
      await act(async () => {
        success = await result.current.updateConnection('conn-1', { first_name: 'Updated' });
      });

      expect(success).toBe(false);
      expect(result.current.error).toBe('Network error');
    });

    it('does not update non-matching connection', async () => {
      const existingConnection = {
        ...createMockConnection({ first_name: 'Original' }),
        connection_id: 'conn-1',
      };

      mockGetConnections.mockResolvedValueOnce({
        success: true,
        data: { connections: [existingConnection] },
      });

      mockUpdateConnection.mockResolvedValueOnce({
        success: true,
        data: { first_name: 'Updated' },
      });

      const { result } = renderHook(() => useConnections());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.updateConnection('conn-2', { first_name: 'Updated' });
      });

      // Original connection should remain unchanged
      expect(result.current.connections[0].first_name).toBe('Original');
    });
  });

  describe('no user', () => {
    it('returns empty connections when user is null', async () => {
      mockUseAuth.mockReturnValue({ user: null, isLoading: false });

      const { result } = renderHook(() => useConnections());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.connections).toEqual([]);
      expect(mockGetConnections).not.toHaveBeenCalled();
    });
  });
});
