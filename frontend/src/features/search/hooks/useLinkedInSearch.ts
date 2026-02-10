import { useState, useCallback } from 'react';
import { useToast } from '@/shared/hooks';
import { useSearchResults } from '@/features/search';
import { useUserProfile } from '@/features/profile';
import type { SearchFormData } from '@/shared/utils/validation';
import { createLogger } from '@/shared/utils/logger';

const logger = createLogger('useLinkedInSearch');

interface UseLinkedInSearchOptions {
  fetchConnections: () => Promise<void>;
}

export function useLinkedInSearch({ fetchConnections }: UseLinkedInSearchOptions) {
  const { toast } = useToast();
  const { ciphertext: linkedInCredsCiphertext } = useUserProfile();
  const [isSearchingLinkedIn, setIsSearchingLinkedIn] = useState(false);

  const { loading, error, infoMessage, searchLinkedIn } = useSearchResults();

  const handleLinkedInSearch = useCallback(
    async (filters: { company: string; job: string; location: string; userId: string }) => {
      setIsSearchingLinkedIn(true);
      try {
        const searchData: SearchFormData = {
          companyName: filters.company,
          companyRole: filters.job,
          companyLocation: filters.location,
          searchName: '',
          searchPassword: '',
          userId: filters.userId,
        };
        logger.debug('Search data prepared', {
          hasCiphertext: !!linkedInCredsCiphertext,
          searchDataKeys: Object.keys(searchData),
        });
        await searchLinkedIn(searchData);
        await fetchConnections();
      } catch (error) {
        logger.error('Error searching LinkedIn', { error });
        toast({
          title: 'Search Failed',
          description: 'Failed to search LinkedIn. Please try again.',
          variant: 'destructive',
        });
      } finally {
        setIsSearchingLinkedIn(false);
      }
    },
    [linkedInCredsCiphertext, searchLinkedIn, fetchConnections, toast]
  );

  return {
    isSearchingLinkedIn,
    searchLoading: loading,
    searchError: error,
    searchInfoMessage: infoMessage,
    handleLinkedInSearch,
  };
}
