import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { puppeteerApiService } from '@/shared/services';
import { useAuth } from '@/features/auth';
import { queryKeys } from '@/shared/lib/queryKeys';
import type { Connection } from '@/shared/types';

export const useConnections = (filters?: {
  status?: string;
  tags?: string[];
  limit?: number;
}) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Query for fetching connections
  const {
    data: connections = [],
    isLoading: loading,
    error,
    refetch,
  } = useQuery({
    queryKey: queryKeys.connections.byUser(user?.id ?? ''),
    queryFn: async () => {
      const response = await puppeteerApiService.getConnections(filters);
      if (response.success && response.data) {
        return (response.data.connections || []) as Connection[];
      }
      throw new Error(response.error || 'Failed to fetch connections');
    },
    enabled: !!user,
  });

  // Mutation for creating connection
  const createMutation = useMutation({
    mutationFn: (data: Partial<Connection>) =>
      puppeteerApiService.createConnection(data),
    onSuccess: (response) => {
      if (response.success && response.data) {
        queryClient.setQueryData(
          queryKeys.connections.byUser(user?.id ?? ''),
          (old: Connection[] = []) => [...old, response.data as Connection]
        );
      }
    },
  });

  // Mutation for updating connection
  const updateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Connection> }) =>
      puppeteerApiService.updateConnection(id, updates),
    onSuccess: (response, { id, updates }) => {
      if (response.success) {
        // Safely merge response.data if it's a valid object with connection fields
        const responseData = response.data && typeof response.data === 'object'
          ? response.data as Partial<Connection>
          : {};
        queryClient.setQueryData(
          queryKeys.connections.byUser(user?.id ?? ''),
          (old: Connection[] = []) =>
            old.map((conn) =>
              conn.id === id ? { ...conn, ...updates, ...responseData } : conn
            )
        );
      }
    },
  });

  const createConnection = async (data: Partial<Connection>): Promise<boolean> => {
    try {
      const result = await createMutation.mutateAsync(data);
      return result.success;
    } catch {
      return false;
    }
  };

  const updateConnection = async (
    connectionId: string,
    updates: Partial<Connection>
  ): Promise<boolean> => {
    try {
      const result = await updateMutation.mutateAsync({ id: connectionId, updates });
      return result.success;
    } catch {
      return false;
    }
  };

  return {
    connections,
    loading,
    error: error?.message ?? null,
    refetch,
    createConnection,
    updateConnection,
  };
};
