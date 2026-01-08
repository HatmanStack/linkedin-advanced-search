import { useState, useEffect, useCallback } from 'react';
import { puppeteerApiService } from '@/shared/services';
import { useAuth } from '@/features/auth';

// Using 'any' for connections due to runtime shape mismatch between API response and Connection type
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ConnectionItem = any;

export const useConnections = (filters?: {
  status?: string;
  tags?: string[];
  limit?: number;
}) => {
  const { user } = useAuth();
  const [connections, setConnections] = useState<ConnectionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchConnections = useCallback(async () => {
    if (!user) {
      setConnections([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await puppeteerApiService.getConnections(filters);

      if (response.success && response.data) {
        setConnections(response.data.connections || []);
      } else {
        setError(response.error || 'Failed to fetch connections');
        setConnections([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setConnections([]);
    } finally {
      setLoading(false);
    }
  }, [user, filters]);

  useEffect(() => {
    fetchConnections();
  }, [fetchConnections]);

  const createConnection = useCallback(async (
    connectionData: unknown
  ): Promise<boolean> => {
    try {
      const response = await puppeteerApiService.createConnection(connectionData);

      if (response.success && response.data) {
        setConnections(prev => [...prev, response.data!]);
        return true;
      } else {
        setError(response.error || 'Failed to create connection');
        return false;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      return false;
    }
  }, []);

  const updateConnection = useCallback(async (
    connectionId: string,
    updates: unknown
  ): Promise<boolean> => {
    try {
      const response = await puppeteerApiService.updateConnection(connectionId, updates);

      if (response.success && response.data) {
        const updatedData = response.data as Record<string, unknown>;
        setConnections(prev =>
          prev.map((conn: ConnectionItem) =>
            conn.connection_id === connectionId
              ? { ...conn, ...updatedData }
              : conn
          )
        );
        return true;
      } else {
        setError(response.error || 'Failed to update connection');
        return false;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      return false;
    }
  }, []);

  return {
    connections,
    loading,
    error,
    refetch: fetchConnections,
    createConnection,
    updateConnection,
  };
};
