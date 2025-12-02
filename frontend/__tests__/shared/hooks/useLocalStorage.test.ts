import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

vi.mock('@/shared/utils/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

import useLocalStorage from '@/shared/hooks/useLocalStorage';

describe('useLocalStorage', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('Initial Value', () => {
    it('returns initial value when no stored value exists', () => {
      const { result } = renderHook(() => useLocalStorage('test-key', 'initial'));
      expect(result.current[0]).toBe('initial');
    });

    it('returns stored value when it exists', () => {
      localStorage.setItem('test-key', JSON.stringify('stored-value'));
      const { result } = renderHook(() => useLocalStorage('test-key', 'initial'));
      expect(result.current[0]).toBe('stored-value');
    });

    it('returns initial value when stored JSON is invalid', () => {
      localStorage.setItem('test-key', 'invalid-json');
      const { result } = renderHook(() => useLocalStorage('test-key', 'initial'));
      expect(result.current[0]).toBe('initial');
    });

    it('handles complex initial values', () => {
      const complexValue = {
        name: 'test',
        data: [1, 2, 3],
        nested: { value: true },
      };
      const { result } = renderHook(() => useLocalStorage('complex-key', complexValue));
      expect(result.current[0]).toEqual(complexValue);
    });

    it('handles array initial values', () => {
      const arrayValue = ['a', 'b', 'c'];
      const { result } = renderHook(() => useLocalStorage('array-key', arrayValue));
      expect(result.current[0]).toEqual(arrayValue);
    });
  });

  describe('setValue', () => {
    it('updates state and localStorage with new value', () => {
      const { result } = renderHook(() => useLocalStorage('test-key', 'initial'));

      act(() => {
        result.current[1]('new-value');
      });

      expect(result.current[0]).toBe('new-value');
      expect(localStorage.getItem('test-key')).toBe(JSON.stringify('new-value'));
    });

    it('accepts a function updater', () => {
      const { result } = renderHook(() => useLocalStorage<number>('counter', 0));

      act(() => {
        result.current[1]((prev) => prev + 1);
      });

      expect(result.current[0]).toBe(1);

      act(() => {
        result.current[1]((prev) => prev + 5);
      });

      expect(result.current[0]).toBe(6);
    });

    it('updates complex objects', () => {
      const { result } = renderHook(() =>
        useLocalStorage<{ count: number; items: string[] }>('complex', {
          count: 0,
          items: [],
        })
      );

      act(() => {
        result.current[1]({ count: 5, items: ['a', 'b'] });
      });

      expect(result.current[0]).toEqual({ count: 5, items: ['a', 'b'] });
      expect(JSON.parse(localStorage.getItem('complex')!)).toEqual({
        count: 5,
        items: ['a', 'b'],
      });
    });

    it('handles arrays', () => {
      const { result } = renderHook(() => useLocalStorage<string[]>('array', []));

      act(() => {
        result.current[1](['item1', 'item2']);
      });

      expect(result.current[0]).toEqual(['item1', 'item2']);

      act(() => {
        result.current[1]((prev) => [...prev, 'item3']);
      });

      expect(result.current[0]).toEqual(['item1', 'item2', 'item3']);
    });

    it('handles null values', () => {
      const { result } = renderHook(() => useLocalStorage<string | null>('nullable', 'initial'));

      act(() => {
        result.current[1](null);
      });

      expect(result.current[0]).toBeNull();
      expect(localStorage.getItem('nullable')).toBe('null');
    });
  });

  describe('removeValue', () => {
    it('removes item from localStorage and resets to initial value', () => {
      localStorage.setItem('test-key', JSON.stringify('stored'));

      const { result } = renderHook(() => useLocalStorage('test-key', 'initial'));

      expect(result.current[0]).toBe('stored');

      act(() => {
        result.current[2]();
      });

      expect(result.current[0]).toBe('initial');
      expect(localStorage.getItem('test-key')).toBeNull();
    });

    it('works after setValue', () => {
      const { result } = renderHook(() => useLocalStorage('test-key', 'initial'));

      act(() => {
        result.current[1]('new-value');
      });

      expect(result.current[0]).toBe('new-value');

      act(() => {
        result.current[2]();
      });

      expect(result.current[0]).toBe('initial');
      expect(localStorage.getItem('test-key')).toBeNull();
    });
  });

  describe('Storage Event Handling', () => {
    it('updates state when storage event fires', () => {
      const { result } = renderHook(() => useLocalStorage('test-key', 'initial'));

      act(() => {
        const event = new StorageEvent('storage', {
          key: 'test-key',
          newValue: JSON.stringify('external-update'),
        });
        window.dispatchEvent(event);
      });

      expect(result.current[0]).toBe('external-update');
    });

    it('ignores storage events for different keys', () => {
      const { result } = renderHook(() => useLocalStorage('test-key', 'initial'));

      act(() => {
        result.current[1]('local-value');
      });

      act(() => {
        const event = new StorageEvent('storage', {
          key: 'different-key',
          newValue: JSON.stringify('should-not-update'),
        });
        window.dispatchEvent(event);
      });

      expect(result.current[0]).toBe('local-value');
    });

    it('ignores storage events with null newValue', () => {
      const { result } = renderHook(() => useLocalStorage('test-key', 'initial'));

      act(() => {
        result.current[1]('local-value');
      });

      act(() => {
        const event = new StorageEvent('storage', {
          key: 'test-key',
          newValue: null,
        });
        window.dispatchEvent(event);
      });

      expect(result.current[0]).toBe('local-value');
    });

    it('handles invalid JSON in storage events', () => {
      const { result } = renderHook(() => useLocalStorage('test-key', 'initial'));

      act(() => {
        result.current[1]('local-value');
      });

      act(() => {
        const event = new StorageEvent('storage', {
          key: 'test-key',
          newValue: 'invalid-json',
        });
        window.dispatchEvent(event);
      });

      expect(result.current[0]).toBe('local-value');
    });

    it('cleans up event listener on unmount', () => {
      const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
      const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

      const { unmount } = renderHook(() => useLocalStorage('test-key', 'initial'));

      expect(addEventListenerSpy).toHaveBeenCalledWith('storage', expect.any(Function));

      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith('storage', expect.any(Function));

      addEventListenerSpy.mockRestore();
      removeEventListenerSpy.mockRestore();
    });
  });

  describe('Multiple Hooks with Same Key', () => {
    it('shares state between hooks with same key', () => {
      const { result: result1 } = renderHook(() => useLocalStorage('shared-key', 'initial'));
      const { result: result2 } = renderHook(() => useLocalStorage('shared-key', 'initial'));

      expect(result1.current[0]).toBe('initial');
      expect(result2.current[0]).toBe('initial');

      act(() => {
        result1.current[1]('updated');
      });

      expect(localStorage.getItem('shared-key')).toBe(JSON.stringify('updated'));
    });
  });

  describe('Type Safety', () => {
    it('correctly types string values', () => {
      const { result } = renderHook(() => useLocalStorage<string>('string-key', ''));
      const value: string = result.current[0];
      expect(typeof value).toBe('string');
    });

    it('correctly types number values', () => {
      const { result } = renderHook(() => useLocalStorage<number>('number-key', 0));
      const value: number = result.current[0];
      expect(typeof value).toBe('number');
    });

    it('correctly types boolean values', () => {
      const { result } = renderHook(() => useLocalStorage<boolean>('boolean-key', false));
      const value: boolean = result.current[0];
      expect(typeof value).toBe('boolean');
    });

    it('correctly types object values', () => {
      interface TestObject {
        id: number;
        name: string;
      }
      const { result } = renderHook(() =>
        useLocalStorage<TestObject>('object-key', { id: 0, name: '' })
      );
      const value: TestObject = result.current[0];
      expect(value).toHaveProperty('id');
      expect(value).toHaveProperty('name');
    });
  });
});
