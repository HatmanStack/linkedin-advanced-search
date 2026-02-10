import { useCallback, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import useLocalStorage from '@/hooks/useLocalStorage';
import { puppeteerApiService } from '@/shared/services';
import type { SearchFormData } from '@/shared/utils/validation';
import { STORAGE_KEYS } from '@/config/appConfig';
import { queryKeys } from '@/shared/lib/queryKeys';

interface UseSearchResultsReturn {
  results: string[];
  visitedLinks: Record<string, boolean>;
  loading: boolean;
  error: string | null;
  infoMessage: string | null;
  searchLinkedIn: (searchData: SearchFormData) => Promise<void>;
  markAsVisited: (profileId: string) => void;
  clearResults: () => void;
  clearVisitedLinks: () => void;
}

function useSearchResults(): UseSearchResultsReturn {
  const queryClient = useQueryClient();

  // Local storage for persistence (stays in localStorage - not server state)
  const [results, setResults] = useLocalStorage<string[]>(
    STORAGE_KEYS.SEARCH_RESULTS,
    []
  );

  const [visitedLinks, setVisitedLinks] = useLocalStorage<Record<string, boolean>>(
    STORAGE_KEYS.VISITED_LINKS,
    {}
  );

  // State for informational message from search API
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  // Search mutation via React Query
  const searchMutation = useMutation({
    mutationFn: (searchData: SearchFormData) =>
      puppeteerApiService.performLinkedInSearch(searchData),
    onSuccess: (response) => {
      if (response?.message) {
        setInfoMessage(response.message);
      }
      // Invalidate connections cache to refetch after search
      queryClient.invalidateQueries({ queryKey: queryKeys.connections.all });
    },
    onError: () => {
      setInfoMessage(null);
    },
  });

  // LinkedIn search via puppeteer backend
  const searchLinkedIn = useCallback(
    async (searchFormData: SearchFormData) => {
      setInfoMessage(null);
      try {
        await searchMutation.mutateAsync(searchFormData);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Search failed';
        setInfoMessage(`Search error: ${errorMessage}`);
      }
    },
    [searchMutation]
  );

  // Mark a profile as visited
  const markAsVisited = useCallback(
    (profileId: string) => {
      setVisitedLinks(prev => ({
        ...prev,
        [profileId]: true,
      }));
    },
    [setVisitedLinks]
  );

  // Clear search results
  const clearResults = useCallback(() => {
    setResults([]);
  }, [setResults]);

  // Clear visited links
  const clearVisitedLinks = useCallback(() => {
    setVisitedLinks({});
  }, [setVisitedLinks]);

  return {
    results,
    visitedLinks,
    loading: searchMutation.isPending,
    error: searchMutation.error?.message ?? null,
    infoMessage,
    searchLinkedIn,
    markAsVisited,
    clearResults,
    clearVisitedLinks,
  };
}

export default useSearchResults;
