import type { Connection } from '@/shared/types';

interface CacheStats {
  hits: number;
  misses: number;
  evictions: number;
  size: number;
  maxSize: number;
}


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

  
  setNamespace(namespace: string | null): void {
    this.namespace = namespace && namespace.trim().length > 0 ? namespace : null;
  }

  
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
        if (connection && connection.id) {
          this.cache.set(connection.id, connection);
        }
      }
      this.stats.size = this.cache.size;
    } catch { /* localStorage unavailable */ }
  }

  
  private saveToStorage(): void {
    if (!this.namespace) return;
    try {
      const key = `${this.storageKeyBase}${this.namespace}`;
      const serialized = JSON.stringify(this.getAll());
      localStorage.setItem(key, serialized);
    } catch { /* localStorage unavailable */ }
  }

  
  get(id: string): Connection | undefined {
    const item = this.cache.get(id);
    
    if (item) {
      this.cache.delete(id);
      this.cache.set(id, item);
      this.stats.hits++;
      return item;
    }
    
    this.stats.misses++;
    return undefined;
  }

  
  set(id: string, connection: Connection): void {
    if (this.cache.has(id)) {
      this.cache.delete(id);
      this.cache.set(id, connection);
      this.saveToStorage();
      return;
    }

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

  
  has(id: string): boolean {
    return this.cache.has(id);
  }

  
  delete(id: string): boolean {
    const deleted = this.cache.delete(id);
    if (deleted) {
      this.stats.size = this.cache.size;
      this.saveToStorage();
    }
    return deleted;
  }

  
  clear(): void {
    this.cache.clear();
    this.stats.size = 0;
    this.stats.hits = 0;
    this.stats.misses = 0;
    this.stats.evictions = 0;
    this.saveToStorage();
  }

  
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

  
  setMultiple(connections: Connection[]): void {
    for (const connection of connections) {
      this.set(connection.id, connection);
    }
    this.saveToStorage();
  }

  
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

  
  getAll(): Connection[] {
    return Array.from(this.cache.values());
  }

  
  getAllIds(): string[] {
    return Array.from(this.cache.keys());
  }

  
  getStats(): CacheStats {
    return {
      ...this.stats,
      size: this.cache.size
    };
  }

  
  getHitRate(): number {
    const total = this.stats.hits + this.stats.misses;
    return total === 0 ? 0 : (this.stats.hits / total) * 100;
  }

  
  isFull(): boolean {
    return this.cache.size >= this.maxSize;
  }

  
  size(): number {
    return this.cache.size;
  }

  
  getMaxSize(): number {
    return this.maxSize;
  }

  
  getByStatus(status: string): Connection[] {
    const connections: Connection[] = [];
    for (const connection of this.cache.values()) {
      if (connection.status === status) {
        connections.push(connection);
      }
    }
    return connections;
  }

  
  preload(connections: Connection[]): void {
    const sortedConnections = [...connections].sort((a, b) => {
      const statusPriority = { ally: 3, incoming: 2, outgoing: 1, possible: 0 };
      const aPriority = statusPriority[a.status as keyof typeof statusPriority] || 0;
      const bPriority = statusPriority[b.status as keyof typeof statusPriority] || 0;
      
      if (aPriority !== bPriority) {
        return bPriority - aPriority;
      }
      
      if (a.date_added && b.date_added) {
        return new Date(b.date_added).getTime() - new Date(a.date_added).getTime();
      }
      
      return 0;
    });

    const connectionsToLoad = sortedConnections.slice(0, this.maxSize);
    this.setMultiple(connectionsToLoad);
    this.saveToStorage();
  }
}

export const connectionCache = new ConnectionCache(1000);

export type { CacheStats };