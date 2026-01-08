import { useState, useEffect, useCallback } from 'react';
import { puppeteerApiService } from '@/shared/services';
import { useAuth } from '@/features/auth';
import type { Connection } from '@/shared/types';

export const useConnections = (filters?: {
  status?: string;
  tags?: string[];
  limit?: number;
}) => {
  const { user } = useAuth();
  const [connections, setConnections] = useState<Connection[]>([]);
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
        // API service returns validated Connection[] data
        setConnections((response.data.connections || []) as Connection[]);
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
    connectionData: Partial<Connection>
  ): Promise<boolean> => {
    try {
      const response = await puppeteerApiService.createConnection(connectionData);

      if (response.success && response.data) {
        setConnections(prev => [...prev, response.data as Connection]);
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
    updates: Partial<Connection>
  ): Promise<boolean> => {
    try {
      const response = await puppeteerApiService.updateConnection(connectionId, updates);

      if (response.success && response.data) {
        const updatedData = response.data as Partial<Connection>;
        setConnections(prev =>
          prev.map((conn: Connection) =>
            conn.id === connectionId
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
