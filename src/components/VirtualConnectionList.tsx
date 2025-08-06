import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { FixedSizeList as List } from 'react-window';
import ConnectionCard from './ConnectionCard';
import NewConnectionCard from './NewConnectionCard';
import ConnectionFiltersComponent from './ConnectionFilters';
import { filterConnections, sortConnections } from '@/utils/connectionFiltering';
import type { Connection, ConnectionFilters } from '@/types';

interface VirtualConnectionListProps {
  connections: Connection[];
  isNewConnection?: boolean;
  onSelect?: (connectionId: string) => void;
  onNewConnectionClick?: (connection: Connection) => void;
  onRemove?: (connectionId: string) => void;
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
  // Checkbox functionality props
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
    onRemove?: (connectionId: string) => void;
    onTagClick?: (tag: string) => void;
    onMessageClick?: (connection: Connection) => void;
    activeTags?: string[];
    selectedConnectionId?: string;
    // Checkbox functionality
    showCheckboxes?: boolean;
    selectedConnections?: string[];
    onCheckboxChange?: (connectionId: string, checked: boolean) => void;
  };
}

// Individual list item component for react-window
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
          isCheckboxEnabled={connection.status === 'allies'}
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
  itemHeight = 200, // Default height for connection cards
  overscanCount = 5, // Pre-render 5 items above/below viewport
  showFilters = true,
  initialFilters = {},
  sortBy = 'name',
  sortOrder = 'asc',
  showCheckboxes = false,
  selectedConnections = [],
  onCheckboxChange
}) => {
  const [containerHeight, setContainerHeight] = useState(600); // Default height
  const [containerRef, setContainerRef] = useState<HTMLDivElement | null>(null);
  const [filters, setFilters] = useState<ConnectionFilters>(initialFilters);

  // Handle window resize events for responsive behavior
  const handleResize = useCallback(() => {
    if (containerRef) {
      const rect = containerRef.getBoundingClientRect();
      const availableHeight = window.innerHeight - rect.top - 100; // Leave some margin
      
      if (isNewConnection) {
        // For new connections, use at least 80vh and allow it to grow larger
        const minHeight = Math.max(window.innerHeight * 0.8, 600);
        setContainerHeight(Math.max(minHeight, availableHeight));
      } else {
        // For regular connections, keep the original behavior
        setContainerHeight(Math.max(400, Math.min(800, availableHeight)));
      }
    }
  }, [containerRef, isNewConnection]);

  useEffect(() => {
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [handleResize]);

  // Apply filters and sorting to connections
  const processedConnections = useMemo(() => {
    let filtered = filterConnections(connections, filters);
    return sortConnections(filtered, sortBy, sortOrder);
  }, [connections, filters, sortBy, sortOrder]);

  // Handle filter changes
  const handleFiltersChange = useCallback((newFilters: ConnectionFilters) => {
    setFilters(newFilters);
  }, []);

  // Memoize the data object to prevent unnecessary re-renders
  const itemData = useMemo(() => ({
    connections: processedConnections,
    isNewConnection,
    onSelect,
    onNewConnectionClick,
    onRemove,
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
    onRemove,
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
      {/* Filter Component */}
      {showFilters && (
        <ConnectionFiltersComponent
          connections={connections}
          filters={filters}
          onFiltersChange={handleFiltersChange}
          isNewConnection={isNewConnection}
          className="mb-4"
        />
      )}

      {/* Results Summary */}
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

      {/* Connection List or Empty State */}
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