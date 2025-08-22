import { useState, useCallback } from 'react';
import { ApiError } from '@/services/puppeteerApiService';

interface UseApiState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

interface UseApiReturn<T, P extends any[]> extends UseApiState<T> {
  execute: (...params: P) => Promise<void>;
  reset: () => void;
}

function useApi<T, P extends any[]>(
  apiFunction: (...params: P) => Promise<T>
): UseApiReturn<T, P> {
  const [state, setState] = useState<UseApiState<T>>({
    data: null,
    loading: false,
    error: null,
  });

  const execute = useCallback(
    async (...params: P) => {
      setState(prev => ({
        ...prev,
        loading: true,
        error: null,
      }));

      try {
        const data = await apiFunction(...params);
        setState({
          data,
          loading: false,
          error: null,
        });
      } catch (error) {
        let errorMessage = 'An unexpected error occurred';
        
        if (error instanceof ApiError) {
          errorMessage = error.message;
        } else if (error instanceof Error) {
          errorMessage = error.message;
        }

        setState({
          data: null,
          loading: false,
          error: errorMessage,
        });
      }
    },
    [apiFunction]
  );

  const reset = useCallback(() => {
    setState({
      data: null,
      loading: false,
      error: null,
    });
  }, []);

  return {
    ...state,
    execute,
    reset,
  };
}

export default useApi;