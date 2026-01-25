import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/features/auth';
import { useToast } from '@/shared/hooks';
import { lambdaApiService as dbConnector, ApiError } from '@/shared/services';
import { connectionCache } from '../utils/connectionCache';
import { connectionChangeTracker } from '../utils/connectionChangeTracker';
import type { Connection, StatusValue, ConnectionCounts } from '@/types';
import { createLogger } from '@/shared/utils/logger';

const logger = createLogger('useConnectionsManager');

export function useConnectionsManager() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [connections, setConnections] = useState<Connection[]>([]);
  const [connectionsLoading, setConnectionsLoading] = useState(false);
  const [connectionsError, setConnectionsError] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<StatusValue>('all');
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const [connectionCounts, setConnectionCounts] = useState<ConnectionCounts>({
    incoming: 0,
    outgoing: 0,
    ally: 0,
    total: 0
  });
  const [selectedConnections, setSelectedConnections] = useState<string[]>([]);

  const calculateConnectionCounts = useCallback((conns: Connection[]): ConnectionCounts => {
    const counts = { incoming: 0, outgoing: 0, ally: 0, total: 0 };
    conns.forEach(connection => {
      switch (connection.status) {
        case 'incoming': counts.incoming++; break;
        case 'outgoing': counts.outgoing++; break;
        case 'ally': counts.ally++; break;
      }
    });
    counts.total = counts.incoming + counts.outgoing + counts.ally;
    return counts;
  }, []);

  // Initialize connections on mount
  useEffect(() => {
    if (!user) return;

    connectionCache.setNamespace(user.id);
    connectionCache.loadFromStorage();

    const cached = connectionCache.getAll();
    const hasChanged = connectionChangeTracker.hasChanged();
    const sessionInitKey = `connectionsInit:${user.id}`;
    const hasInitializedThisSession = sessionStorage.getItem(sessionInitKey) === 'true';
    const shouldRefetch = hasChanged || (!hasInitializedThisSession && cached.length === 0);

    if (shouldRefetch) {
      const controller = new AbortController();
      (async () => {
        setConnectionsLoading(true);
        setConnectionsError(null);
        try {
          const fetchedConnections = await dbConnector.getConnectionsByStatus();
          if (controller.signal.aborted) return;
          setConnections(fetchedConnections);
          connectionCache.setMultiple(fetchedConnections);
          setConnectionCounts(calculateConnectionCounts(fetchedConnections));
          connectionChangeTracker.clearChanged();
          sessionStorage.setItem(sessionInitKey, 'true');
        } catch (err: unknown) {
          if (controller.signal.aborted) return;
          setConnectionsError(err instanceof ApiError ? err.message : 'Failed to fetch connections');
        } finally {
          if (!controller.signal.aborted) setConnectionsLoading(false);
        }
      })();
      return () => controller.abort();
    } else {
      setConnections(cached);
      setConnectionCounts(calculateConnectionCounts(cached));
      if (!hasInitializedThisSession) {
        sessionStorage.setItem(sessionInitKey, 'true');
      }
    }
  }, [user, calculateConnectionCounts]);

  const fetchConnections = useCallback(async () => {
    if (!user || connectionsLoading) return;
    setConnectionsLoading(true);
    setConnectionsError(null);
    try {
      const fetchedConnections = await dbConnector.getConnectionsByStatus();
      setConnections(fetchedConnections);
      connectionCache.setMultiple(fetchedConnections);
      setConnectionCounts(calculateConnectionCounts(fetchedConnections));
      connectionChangeTracker.clearChanged();
      logger.info('Connections fetched successfully', { count: fetchedConnections.length });
    } catch (err: unknown) {
      logger.error('Error fetching connections', { error: err });
      const errorMessage = err instanceof ApiError ? err.message : 'Failed to fetch connections';
      setConnectionsError(errorMessage);
      toast({ title: "Failed to Load Connections", description: errorMessage, variant: "destructive" });
    } finally {
      setConnectionsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, toast, calculateConnectionCounts]);

  const handleTagClick = useCallback((tag: string) => {
    setActiveTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  }, []);

  const toggleConnectionSelection = useCallback((connectionId: string) => {
    setSelectedConnections(prev =>
      prev.includes(connectionId) ? prev.filter(id => id !== connectionId) : [...prev, connectionId]
    );
  }, []);

  const handleConnectionCheckboxChange = useCallback((connectionId: string, checked: boolean) => {
    setSelectedConnections(prev => {
      if (checked) return prev.includes(connectionId) ? prev : [...prev, connectionId];
      return prev.filter(id => id !== connectionId);
    });
  }, []);

  const updateConnectionStatus = useCallback((connectionId: string, newStatus: string) => {
    setConnections(prev => {
      const updated = prev.map(c => c.id === connectionId ? { ...c, status: newStatus } : c);
      setConnectionCounts(calculateConnectionCounts(updated));
      return updated;
    });
    connectionCache.update(connectionId, { status: newStatus });
  }, [calculateConnectionCounts]);

  const filteredConnections = useMemo(() => {
    let list = connections.filter(connection => {
      if (selectedStatus === 'all') return ['incoming', 'outgoing', 'ally'].includes(connection.status);
      return connection.status === selectedStatus;
    });
    if (activeTags.length > 0) {
      list = [...list].sort((a, b) => {
        const aTagsMatch = (a.tags || a.common_interests || []).filter((t: string) => activeTags.includes(t)).length;
        const bTagsMatch = (b.tags || b.common_interests || []).filter((t: string) => activeTags.includes(t)).length;
        if (aTagsMatch !== bTagsMatch) return bTagsMatch - aTagsMatch;
        return `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`);
      });
    }
    return list;
  }, [connections, selectedStatus, activeTags]);

  const newConnections = useMemo(() => {
    return connections.filter(connection => connection.status === 'possible');
  }, [connections]);

  const selectedConnectionsCount = useMemo(() => selectedConnections.length, [selectedConnections]);

  return {
    connections,
    connectionsLoading,
    connectionsError,
    selectedStatus,
    setSelectedStatus,
    activeTags,
    connectionCounts,
    selectedConnections,
    filteredConnections,
    newConnections,
    selectedConnectionsCount,
    fetchConnections,
    handleTagClick,
    toggleConnectionSelection,
    handleConnectionCheckboxChange,
    updateConnectionStatus,
    calculateConnectionCounts,
  };
}
