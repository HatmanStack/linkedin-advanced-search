const STORAGE_KEY = 'connectionsChanged';

type ChangeSource = 'search' | 'interaction' | 'init';

/**
 * Tracks whether connections have changed since last fetch.
 * Uses localStorage as a cross-tab notification mechanism.
 * All storage operations are wrapped in try-catch because localStorage
 * may be unavailable (private browsing, disabled, quota exceeded).
 * When storage fails, the app treats data as stale and refetches - safe fallback.
 */
export const connectionChangeTracker = {
  markChanged(source: ChangeSource = 'interaction'): void {
    try {
      const payload = {
        changed: true,
        source,
        at: new Date().toISOString(),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // Non-fatal: worst case is an extra API refetch
    }
  },

  clearChanged(): void {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Non-fatal: flag remains, causing an extra refetch next time
    }
  },

  hasChanged(): boolean {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      const data = JSON.parse(raw);
      return !!data?.changed;
    } catch {
      return false;
    }
  },
};

export default connectionChangeTracker;


