import { useCallback, useState } from 'react';
import useLocalStorage from '@/shared/hooks/useLocalStorage';
import { puppeteerApiService } from '@/shared/services';
import type { SearchFormData } from '@/shared/utils/validation';
import { STORAGE_KEYS } from '@/config/appConfig';
import { connectionChangeTracker } from '@/features/connections';

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
  const [results, setResults] = useLocalStorage<string[]>(
    STORAGE_KEYS.SEARCH_RESULTS,
    []
  );

  const [visitedLinks, setVisitedLinks] = useLocalStorage<Record<string, boolean>>(
    STORAGE_KEYS.VISITED_LINKS,
    {}
  );

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  const searchLinkedIn = useCallback(
    async (searchFormData: SearchFormData) => {
      setLoading(true);
      setError(null);
      setInfoMessage(null);

      try {
        const response = await puppeteerApiService.performLinkedInSearch(searchFormData);

        if (response?.message) {
          setInfoMessage(response.message);
        }

        connectionChangeTracker.markChanged('search');
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Search failed';
        setError(errorMessage);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    []
  );


  const markAsVisited = useCallback(
    (profileId: string) => {
      setVisitedLinks(prev => ({
        ...prev,
        [profileId]: true,
      }));
    },
    [setVisitedLinks]
  );

  const clearResults = useCallback(() => {
    setResults([]);
  }, [setResults]);

  const clearVisitedLinks = useCallback(() => {
    setVisitedLinks({});
  }, [setVisitedLinks]);

  return {
    results,
    visitedLinks,
    loading,
    error,
    infoMessage,
    searchLinkedIn,
    markAsVisited,
    clearResults,
    clearVisitedLinks,
  };
}

export default useSearchResults;