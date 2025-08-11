import { useCallback } from 'react';
import useLocalStorage from './useLocalStorage';
import useApi from './useApi';
import { puppeteerApiService } from '../services/puppeteerApiService';
import type { SearchFormData } from '../utils/validation';
import { STORAGE_KEYS } from '@/config/appConfig';
import { connectionChangeTracker } from '../utils/connectionChangeTracker';

interface UseSearchResultsReturn {
  results: string[];
  visitedLinks: Record<string, boolean>;
  loading: boolean;
  error: string | null;
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

  // API hook for search functionality
  const {
    data: searchData,
    loading,
    error,
    execute: executeSearch,
  } = useApi((searchData: SearchFormData) => puppeteerApiService.searchLinkedIn(searchData));

  // Update results when search completes
  const searchLinkedIn = useCallback(
    async (searchFormData: SearchFormData) => {
      await executeSearch(searchFormData);
      // Mark that connections may have changed due to a search
      connectionChangeTracker.markChanged('search');
    },
    [executeSearch]
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
    searchLinkedIn,
    markAsVisited,
    clearResults,
    clearVisitedLinks,
  };
}

export default useSearchResults;