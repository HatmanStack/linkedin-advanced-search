import { useCallback, useState } from 'react';
import useLocalStorage from './useLocalStorage';
import { puppeteerApiService } from '@/services/puppeteerApiService';
import type { SearchFormData } from '@/utils/validation';
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
  // Local storage for persistence
  const [results, setResults] = useLocalStorage<string[]>(
    STORAGE_KEYS.SEARCH_RESULTS,
    []
  );

  const [visitedLinks, setVisitedLinks] = useLocalStorage<Record<string, boolean>>(
    STORAGE_KEYS.VISITED_LINKS,
    {}
  );

  // State for loading and errors
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // State for informational message from search API
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  // LinkedIn search via puppeteer backend
  const searchLinkedIn = useCallback(
    async (searchFormData: SearchFormData) => {
      setLoading(true);
      setError(null);
      setInfoMessage(null);

      try {
        // Call puppeteer backend for real LinkedIn automation
        const response = await puppeteerApiService.performLinkedInSearch(searchFormData);

        // Extract and store info message from response
        if (response?.message) {
          setInfoMessage(response.message);
        }

        // Mark that connections may have changed due to a search
        connectionChangeTracker.markChanged('search');
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Search failed';
        setError(errorMessage);
        throw err; // Re-throw so Dashboard can handle it
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // We no longer store backend search results locally; DynamoDB is the source of truth

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