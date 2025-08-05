interface Connection {
  id: string;
  first_name: string;
  last_name: string;
  position: string;
  company: string;
  location?: string;
  headline?: string;
  recent_activity?: string;
  common_interests?: string[];
  messages?: number;
  date_added?: string;
  linkedin_url?: string;
  tags?: string[];
  last_action_summary?: string;
  isFakeData?: boolean;
  last_activity_summary?: string;
  status?: 'possible' | 'incoming' | 'outgoing' | 'allies';
  conversion_likelihood?: number;
}

interface CacheStats {
  hits: number;
  misses: number;
  evictions: number;
  size: number;
  maxSize: number;
}

/**
 * LRU (Least Recently Used) Cache for Connection data
 * Provides efficient caching with automatic eviction of least recently used items
 * when the cache reaches its maximum size limit.
 */
export class ConnectionCache {
  private cache = new Map<string, Connection>();
  private readonly maxSize: number;
  private stats: CacheStats;

  constructor(maxSize: number = 1000) {
    this.maxSize = maxSize;
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      size: 0,
      maxSize
    };
  }

  /**
   * Get a connection from the cache
   * Moves the item to the end (most recently used) if found
   */
  get(id: string): Connection | undefined {
    const item = this.cache.get(id);
    
    if (item) {
      // Move to end (most recently used)
      this.cache.delete(id);
      this.cache.set(id, item);
      this.stats.hits++;
      return item;
    }
    
    this.stats.misses++;
    return undefined;
  }

  /**
   * Set a connection in the cache
   * Evicts least recently used item if cache is at capacity
   */
  set(id: string, connection: Connection): void {
    // If item already exists, update it and move to end
    if (this.cache.has(id)) {
      this.cache.delete(id);
      this.cache.set(id, connection);
      return;
    }

    // If at capacity, remove least recently used item
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
        this.stats.evictions++;
      }
    }

    this.cache.set(id, connection);
    this.stats.size = this.cache.size;
  }

  /**
   * Check if a connection exists in the cache
   */
  has(id: string): boolean {
    return this.cache.has(id);
  }

  /**
   * Remove a connection from the cache
   */
  delete(id: string): boolean {
    const deleted = this.cache.delete(id);
    if (deleted) {
      this.stats.size = this.cache.size;
    }
    return deleted;
  }

  /**
   * Clear all connections from the cache
   */
  clear(): void {
    this.cache.clear();
    this.stats.size = 0;
    this.stats.hits = 0;
    this.stats.misses = 0;
    this.stats.evictions = 0;
  }

  /**
   * Get multiple connections from the cache
   * Returns a map of found connections and an array of missing IDs
   */
  getMultiple(ids: string[]): { found: Map<string, Connection>; missing: string[] } {
    const found = new Map<string, Connection>();
    const missing: string[] = [];

    for (const id of ids) {
      const connection = this.get(id);
      if (connection) {
        found.set(id, connection);
      } else {
        missing.push(id);
      }
    }

    return { found, missing };
  }

  /**
   * Set multiple connections in the cache
   */
  setMultiple(connections: Connection[]): void {
    for (const connection of connections) {
      this.set(connection.id, connection);
    }
  }

  /**
   * Invalidate connections that match a predicate
   * Useful for cache invalidation when connections are updated
   */
  invalidateWhere(predicate: (connection: Connection) => boolean): number {
    let invalidated = 0;
    const toDelete: string[] = [];

    for (const [id, connection] of this.cache.entries()) {
      if (predicate(connection)) {
        toDelete.push(id);
      }
    }

    for (const id of toDelete) {
      this.delete(id);
      invalidated++;
    }

    return invalidated;
  }

  /**
   * Update a connection in the cache if it exists
   * Returns true if the connection was found and updated
   */
  update(id: string, updates: Partial<Connection>): boolean {
    const existing = this.cache.get(id);
    if (existing) {
      const updated = { ...existing, ...updates };
      this.set(id, updated);
      return true;
    }
    return false;
  }

  /**
   * Get all connections from the cache as an array
   * Ordered from least recently used to most recently used
   */
  getAll(): Connection[] {
    return Array.from(this.cache.values());
  }

  /**
   * Get all connection IDs from the cache as an array
   * Ordered from least recently used to most recently used
   */
  getAllIds(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    return {
      ...this.stats,
      size: this.cache.size
    };
  }

  /**
   * Get cache hit rate as a percentage
   */
  getHitRate(): number {
    const total = this.stats.hits + this.stats.misses;
    return total === 0 ? 0 : (this.stats.hits / total) * 100;
  }

  /**
   * Check if the cache is at capacity
   */
  isFull(): boolean {
    return this.cache.size >= this.maxSize;
  }

  /**
   * Get the current size of the cache
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Get the maximum size of the cache
   */
  getMaxSize(): number {
    return this.maxSize;
  }

  /**
   * Get connections by status from the cache
   */
  getByStatus(status: string): Connection[] {
    const connections: Connection[] = [];
    for (const connection of this.cache.values()) {
      if (connection.status === status) {
        connections.push(connection);
      }
    }
    return connections;
  }

  /**
   * Preload connections into the cache
   * Useful for warming up the cache with frequently accessed data
   */
  preload(connections: Connection[]): void {
    // Sort by some priority if needed (e.g., by date_added or status)
    const sortedConnections = [...connections].sort((a, b) => {
      // Prioritize 'allies' and 'incoming' connections
      const statusPriority = { allies: 3, incoming: 2, outgoing: 1, possible: 0 };
      const aPriority = statusPriority[a.status as keyof typeof statusPriority] || 0;
      const bPriority = statusPriority[b.status as keyof typeof statusPriority] || 0;
      
      if (aPriority !== bPriority) {
        return bPriority - aPriority;
      }
      
      // Secondary sort by date_added (most recent first)
      if (a.date_added && b.date_added) {
        return new Date(b.date_added).getTime() - new Date(a.date_added).getTime();
      }
      
      return 0;
    });

    // Load up to maxSize connections
    const connectionsToLoad = sortedConnections.slice(0, this.maxSize);
    this.setMultiple(connectionsToLoad);
  }
}

// Create a singleton instance for global use
export const connectionCache = new ConnectionCache(1000);

// Export the Connection interface for use in other files
export type { Connection, CacheStats };