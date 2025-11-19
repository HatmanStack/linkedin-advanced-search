// Connections feature barrel export

// Components
export { ConnectionCard } from './components/ConnectionCard';
export { ConnectionsTab } from './components/ConnectionsTab';
export { ConnectionFilters } from './components/ConnectionFilters';
export { VirtualConnectionList } from './components/VirtualConnectionList';
export { NewConnectionCard } from './components/NewConnectionCard';
export { NewConnectionsTab } from './components/NewConnectionsTab';
export { ConnectionCardSkeleton } from './components/ConnectionCardSkeleton';
export { NewConnectionCardSkeleton } from './components/NewConnectionCardSkeleton';

// Hooks
export { useConnections } from './hooks/useConnections';

// Services
export { connectionDataContextService } from './services/connectionDataContextService';

// Utils
export { connectionCache } from './utils/connectionCache';
export { connectionChangeTracker } from './utils/connectionChangeTracker';
export * from './utils/connectionFiltering';
