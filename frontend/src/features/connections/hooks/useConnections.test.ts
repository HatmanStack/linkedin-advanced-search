import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useConnections } from './useConnections';
import { createWrapper } from '@/test-utils/queryWrapper';
import type { Connection, PuppeteerApiResponse } from '@/shared/types';

// Mock the dependencies
vi.mock('@/shared/services', () => ({
  puppeteerApiService: {
    getConnections: vi.fn(),
    createConnection: vi.fn(),
    updateConnection: vi.fn(),
  },
}));

vi.mock('@/features/auth', () => ({
  useAuth: vi.fn(() => ({ user: { id: 'test-user' } })),
}));

import { puppeteerApiService } from '@/shared/services';
import { useAuth } from '@/features/auth';

const mockGetConnections = puppeteerApiService.getConnections as ReturnType<typeof vi.fn>;
const mockUseAuth = useAuth as ReturnType<typeof vi.fn>;

// Test fixtures
const validConnection: Connection = {
  id: 'conn-1',
  first_name: 'John',
  last_name: 'Doe',
  position: 'Software Engineer',
  company: 'Test Corp',
  status: 'ally',
  conversion_likelihood: 'high',
};

const validConnection2: Connection = {
  id: 'conn-2',
  first_name: 'Jane',
  last_name: 'Smith',
  position: 'Product Manager',
  company: 'Another Corp',
  status: 'possible',
  conversion_likelihood: 'medium',
};

describe('useConnections', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({ user: { id: 'test-user' } });
  });

  describe('fetching connections', () => {
    it('should return typed Connection[] when API returns valid data', async () => {
      const mockResponse: PuppeteerApiResponse<{ connections: Connection[] }> = {
        success: true,
        data: { connections: [validConnection, validConnection2] },
      };
      mockGetConnections.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useConnections(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.connections).toHaveLength(2);
      expect(result.current.connections[0].first_name).toBe('John');
      expect(result.current.connections[0].conversion_likelihood).toBe('high');
      expect(result.current.connections[1].conversion_likelihood).toBe('medium');
      expect(result.current.error).toBeNull();
    });

    it('should handle empty response', async () => {
      const mockResponse: PuppeteerApiResponse<{ connections: Connection[] }> = {
        success: true,
        data: { connections: [] },
      };
      mockGetConnections.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useConnections(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.connections).toEqual([]);
      expect(result.current.error).toBeNull();
    });

    it('should set error state on API failure', async () => {
      const mockResponse: PuppeteerApiResponse<{ connections: Connection[] }> = {
        success: false,
        error: 'Failed to fetch connections',
      };
      mockGetConnections.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useConnections(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.connections).toEqual([]);
      expect(result.current.error).toBe('Failed to fetch connections');
    });

    it('should handle network errors', async () => {
      mockGetConnections.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useConnections(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.connections).toEqual([]);
      expect(result.current.error).toBe('Network error');
    });

    it('should not fetch when user is not authenticated', async () => {
      mockUseAuth.mockReturnValue({ user: null });

      const { result } = renderHook(() => useConnections(), {
        wrapper: createWrapper(),
      });

      // Wait a tick to ensure no fetch was initiated
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockGetConnections).not.toHaveBeenCalled();
      expect(result.current.connections).toEqual([]);
    });

    it('should pass filters to API call', async () => {
      const mockResponse: PuppeteerApiResponse<{ connections: Connection[] }> = {
        success: true,
        data: { connections: [validConnection] },
      };
      mockGetConnections.mockResolvedValue(mockResponse);

      const filters = { status: 'ally', limit: 10 };
      renderHook(() => useConnections(filters), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(mockGetConnections).toHaveBeenCalledWith(filters);
      });
    });
  });

  describe('conversion_likelihood enum handling', () => {
    it('should correctly handle high conversion likelihood', async () => {
      const connectionWithHighLikelihood = { ...validConnection, conversion_likelihood: 'high' as const };
      const mockResponse: PuppeteerApiResponse<{ connections: Connection[] }> = {
        success: true,
        data: { connections: [connectionWithHighLikelihood] },
      };
      mockGetConnections.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useConnections(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.connections[0].conversion_likelihood).toBe('high');
    });

    it('should correctly handle medium conversion likelihood', async () => {
      const connectionWithMediumLikelihood = { ...validConnection, conversion_likelihood: 'medium' as const };
      const mockResponse: PuppeteerApiResponse<{ connections: Connection[] }> = {
        success: true,
        data: { connections: [connectionWithMediumLikelihood] },
      };
      mockGetConnections.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useConnections(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.connections[0].conversion_likelihood).toBe('medium');
    });

    it('should correctly handle low conversion likelihood', async () => {
      const connectionWithLowLikelihood = { ...validConnection, conversion_likelihood: 'low' as const };
      const mockResponse: PuppeteerApiResponse<{ connections: Connection[] }> = {
        success: true,
        data: { connections: [connectionWithLowLikelihood] },
      };
      mockGetConnections.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useConnections(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.connections[0].conversion_likelihood).toBe('low');
    });

    it('should handle connections without conversion_likelihood', async () => {
      const connectionWithoutLikelihood = { ...validConnection };
      delete (connectionWithoutLikelihood as Partial<Connection>).conversion_likelihood;
      const mockResponse: PuppeteerApiResponse<{ connections: Connection[] }> = {
        success: true,
        data: { connections: [connectionWithoutLikelihood] },
      };
      mockGetConnections.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useConnections(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.connections[0].conversion_likelihood).toBeUndefined();
    });
  });
});
