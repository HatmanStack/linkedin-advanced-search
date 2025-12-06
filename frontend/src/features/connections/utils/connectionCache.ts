import type { Connection } from '@/types';

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
  private namespace: string | null = null;
  private readonly storageKeyBase = 'connectionCache:';

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
   * Set a namespace (typically the current user id) for persistent storage
   * When set, the cache will automatically save to localStorage on mutations.
   */
  setNamespace(namespace: string | null): void {
    this.namespace = namespace && namespace.trim().length > 0 ? namespace : null;
  }

  /**
   * Load cache contents from localStorage for the current namespace
   * Overwrites any in-memory contents.
   */
  loadFromStorage(): void {
    if (!this.namespace) return;
    try {
      const key = `${this.storageKeyBase}${this.namespace}`;
      const raw = localStorage.getItem(key);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Connection[];
      if (!Array.isArray(parsed)) return;
      this.cache.clear();
      for (const connection of parsed) {
        if (connection && (connection as unknown).id) {
          this.cache.set((connection as unknown).id, connection);
        }
      }
      this.stats.size = this.cache.size;
    } catch {
      // localStorage errors are non-fatal: private browsing mode, quota exceeded,
      // or disabled storage. The app functions without persistence; data is
      // re-fetched from the API on next session. This is graceful degradation.
    }
  }

  /**
   * Persist current cache contents to localStorage for the current namespace
   */
  private saveToStorage(): void {
    if (!this.namespace) return;
    try {
      const key = `${this.storageKeyBase}${this.namespace}`;
      const serialized = JSON.stringify(this.getAll());
      localStorage.setItem(key, serialized);
    } catch {
      // localStorage errors are non-fatal: private browsing mode, quota exceeded,
      // or disabled storage. The app functions without persistence; data is
      // re-fetched from the API on next session. This is graceful degradation.
    }
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
      this.saveToStorage();
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
    this.saveToStorage();
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
      this.saveToStorage();
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
    this.saveToStorage();
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
    this.saveToStorage();
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
    this.saveToStorage();
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
      this.saveToStorage();
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
      // Prioritize 'ally' and 'incoming' connections
      const statusPriority = { ally: 3, incoming: 2, outgoing: 1, possible: 0 };
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
    this.saveToStorage();
  }
}

// Create a singleton instance for global use
export const connectionCache = new ConnectionCache(1000);

// Export the CacheStats interface for use in other files
export type { CacheStats };