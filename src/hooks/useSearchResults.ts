import { useCallback, useState } from 'react';
import useLocalStorage from './useLocalStorage';
import useApi from './useApi';
import { lambdaApiService } from '@/services/lambdaApiService';
import type { SearchFormData } from '@/utils/validation';
import { STORAGE_KEYS } from '@/config/appConfig';
import { connectionChangeTracker } from '@/utils/connectionChangeTracker';

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

  // State for informational message from search API
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  // API hook for search functionality - using placeholder search API
  const {
    loading,
    error,
    execute: executeSearch,
  } = useApi(async (query: string) => {
    const response = await lambdaApiService.searchProfiles(query);

    // Extract and store info message from response
    if (response?.message) {
      setInfoMessage(response.message);
    }

    return response;
  });

  // Update results when search completes
  const searchLinkedIn = useCallback(
    async (searchFormData: SearchFormData) => {
      // Convert SearchFormData to query string
      const queryParts = [];
      if (searchFormData.companyRole) queryParts.push(searchFormData.companyRole);
      if (searchFormData.companyName) queryParts.push(`at ${searchFormData.companyName}`);
      if (searchFormData.companyLocation) queryParts.push(`in ${searchFormData.companyLocation}`);

      const query = queryParts.join(' ') || 'professionals';

      await executeSearch(query);

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
    infoMessage,
    searchLinkedIn,
    markAsVisited,
    clearResults,
    clearVisitedLinks,
  };
}

export default useSearchResults;