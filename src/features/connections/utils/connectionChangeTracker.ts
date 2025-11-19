const STORAGE_KEY = 'connectionsChanged';

type ChangeSource = 'search' | 'interaction' | 'init';

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
      // Ignore storage errors
    }
  },

  clearChanged(): void {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore storage errors
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


