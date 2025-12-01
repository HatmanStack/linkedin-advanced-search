import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { FixedSizeList as List } from 'react-window';
import ConnectionCard from './ConnectionCard';
import NewConnectionCard from './NewConnectionCard';
import ConnectionFiltersComponent from './ConnectionFilters';
import { filterConnections, sortConnections } from '@/features/connections';
import type { Connection, ConnectionFilters } from '@/shared/types';

interface VirtualConnectionListProps {
  connections: Connection[];
  isNewConnection?: boolean;
  onSelect?: (connectionId: string) => void;
  onNewConnectionClick?: (connection: Connection) => void;
  onRemove?: (connectionId: string, newStatus: string) => void;
  onTagClick?: (tag: string) => void;
  onMessageClick?: (connection: Connection) => void;
  activeTags?: string[];
  selectedConnectionId?: string;
  className?: string;
  itemHeight?: number;
  overscanCount?: number;
  showFilters?: boolean;
  initialFilters?: ConnectionFilters;
  sortBy?: 'name' | 'company' | 'date_added' | 'conversion_likelihood';
  sortOrder?: 'asc' | 'desc';
  showCheckboxes?: boolean;
  selectedConnections?: string[];
  onCheckboxChange?: (connectionId: string, checked: boolean) => void;
}

interface ListItemProps {
  index: number;
  style: React.CSSProperties;
  data: {
    connections: Connection[];
    isNewConnection?: boolean;
    onSelect?: (connectionId: string) => void;
    onNewConnectionClick?: (connection: Connection) => void;
    onRemove?: (connectionId: string, newStatus: string) => void;
    onTagClick?: (tag: string) => void;
    onMessageClick?: (connection: Connection) => void;
    activeTags?: string[];
    selectedConnectionId?: string;
    showCheckboxes?: boolean;
    selectedConnections?: string[];
    onCheckboxChange?: (connectionId: string, checked: boolean) => void;
  };
}

const ListItem: React.FC<ListItemProps> = ({ index, style, data }) => {
  const {
    connections,
    isNewConnection,
    onSelect,
    onNewConnectionClick,
    onRemove,
    onTagClick,
    activeTags,
    selectedConnectionId,
    showCheckboxes,
    selectedConnections,
    onCheckboxChange
  } = data;

  const connection = connections[index];
  
  if (!connection) {
    return <div style={style} />;
  }

  return (
    <div style={style} className="px-2">
      {isNewConnection ? (
        <NewConnectionCard
          connection={connection}
          onRemove={onRemove}
          onSelect={onNewConnectionClick}
          onTagClick={onTagClick}
          activeTags={activeTags}
        />
      ) : (
        <ConnectionCard
          connection={connection}
          isSelected={selectedConnectionId === connection.id}
          isNewConnection={isNewConnection}
          onSelect={onSelect}
          onNewConnectionClick={onNewConnectionClick}
          onTagClick={onTagClick}
          onMessageClick={data.onMessageClick}
          activeTags={activeTags}
          showCheckbox={showCheckboxes}
          isCheckboxEnabled={connection.status === 'ally'}
          isChecked={selectedConnections?.includes(connection.id) || false}
          onCheckboxChange={onCheckboxChange}
        />
      )}
    </div>
  );
};

const VirtualConnectionList: React.FC<VirtualConnectionListProps> = ({
  connections,
  isNewConnection = false,
  onSelect,
  onNewConnectionClick,
  onRemove,
  onTagClick,
  onMessageClick,
  activeTags = [],
  selectedConnectionId,
  className = '',
  itemHeight = 200,
  overscanCount = 5,
  showFilters = true,
  initialFilters = {},
  sortBy = 'name',
  sortOrder = 'asc',
  showCheckboxes = false,
  selectedConnections = [],
  onCheckboxChange
}) => {
  const [containerHeight, setContainerHeight] = useState(600);
  const [containerRef, setContainerRef] = useState<HTMLDivElement | null>(null);
  const [filters, setFilters] = useState<ConnectionFilters>(initialFilters);
  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set());

  const handleResize = useCallback(() => {
    if (containerRef) {
      const rect = containerRef.getBoundingClientRect();
      const availableHeight = window.innerHeight - rect.top - 40;
      
      const minHeight = Math.max(window.innerHeight * 0.9, 700);
      setContainerHeight(Math.max(minHeight, availableHeight));
    }
  }, [containerRef, isNewConnection]);

  useEffect(() => {
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [handleResize]);

  const processedConnections = useMemo(() => {
    let filtered = filterConnections(connections, filters);
    if (removedIds.size > 0) {
      filtered = filtered.filter((c: Connection) => !removedIds.has(c.id));
    }
    if (activeTags && activeTags.length > 0) {
      return filtered;
    }
    return sortConnections(filtered, sortBy, sortOrder);
  }, [connections, filters, sortBy, sortOrder, removedIds, activeTags]);

  const handleFiltersChange = useCallback((newFilters: ConnectionFilters) => {
    setFilters(newFilters);
  }, []);

  const handleRemoveInternal = useCallback((connectionId: string, newStatus: string) => {
    setRemovedIds(prev => {
      const next = new Set(prev);
      next.add(connectionId);
      return next;
    });
    if (onRemove) onRemove(connectionId, newStatus);
  }, [onRemove]);

  const itemData = useMemo(() => ({
    connections: processedConnections,
    isNewConnection,
    onSelect,
    onNewConnectionClick,
    onRemove: handleRemoveInternal,
    onTagClick,
    onMessageClick,
    activeTags,
    selectedConnectionId,
    showCheckboxes,
    selectedConnections,
    onCheckboxChange
  }), [
    processedConnections,
    isNewConnection,
    onSelect,
    onNewConnectionClick,
    handleRemoveInternal,
    onTagClick,
    onMessageClick,
    activeTags,
    selectedConnectionId,
    showCheckboxes,
    selectedConnections,
    onCheckboxChange
  ]);

  return (
    <div className={`w-full space-y-4 ${className}`}>
      {}
      {showFilters && (
        <ConnectionFiltersComponent
          connections={connections}
          filters={filters}
          onFiltersChange={handleFiltersChange}
          isNewConnection={isNewConnection}
          className="mb-4"
        />
      )}

      {}
      {showFilters && (
        <div className="flex items-center justify-between text-sm text-slate-400 px-1">
          <span>
            Showing {processedConnections.length} of {connections.length} connection{connections.length !== 1 ? 's' : ''}
          </span>
          {Object.keys(filters).length > 0 && (
            <span className="text-blue-400">
              {Object.keys(filters).length} filter{Object.keys(filters).length !== 1 ? 's' : ''} active
            </span>
          )}
        </div>
      )}

      {}
      <div 
        ref={setContainerRef}
        style={{ height: containerHeight }}
      >
        {processedConnections.length === 0 ? (
          <div className="flex items-center justify-center h-64 text-slate-400">
            <div className="text-center">
              <p className="text-lg mb-2">
                {connections.length === 0 ? 'No connections found' : 'No connections match your filters'}
              </p>
              <p className="text-sm">
                {connections.length === 0 
                  ? (isNewConnection 
                      ? "No new connections available at the moment."
                      : "Try checking back later or adding some connections.")
                  : "Try adjusting your filters to see more results."
                }
              </p>
            </div>
          </div>
        ) : (
          <List
            height={containerHeight}
            width="100%"
            itemCount={processedConnections.length}
            itemSize={itemHeight}
            itemData={itemData}
            overscanCount={overscanCount}
            className="scrollbar-thin scrollbar-thumb-slate-600 scrollbar-track-slate-800"
          >
            {ListItem}
          </List>
        )}
      </div>
    </div>
  );
};

export default VirtualConnectionList;