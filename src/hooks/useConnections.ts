import { useState, useEffect, useCallback } from 'react';
import { apiService, Connection } from '@/services/apiService';
import { useAuth } from '@/contexts/AuthContext';

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
      
      const response = await apiService.getConnections(filters);
      
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
    connectionData: Omit<Connection, 'connection_id' | 'user_id' | 'created_at' | 'updated_at'>
  ): Promise<boolean> => {
    try {
      const response = await apiService.createConnection(connectionData);
      
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
    updates: Partial<Connection>
  ): Promise<boolean> => {
    try {
      const response = await apiService.updateConnection(connectionId, updates);
      
      if (response.success && response.data) {
        setConnections(prev => 
          prev.map(conn => 
            conn.connection_id === connectionId 
              ? { ...conn, ...response.data }
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
