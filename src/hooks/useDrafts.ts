import { useState, useEffect, useCallback } from 'react';
import { puppeteerApiService, Draft } from '@/services/puppeteerApiService';
import { useAuth } from '@/contexts/AuthContext';

export const useDrafts = () => {
  const { user } = useAuth();
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDrafts = useCallback(async () => {
    if (!user) {
      setDrafts([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const response = await puppeteerApiService.getDrafts();
      
      if (response.success && response.data) {
        setDrafts(response.data);
      } else {
        setError(response.error || 'Failed to fetch drafts');
        setDrafts([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setDrafts([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchDrafts();
  }, [fetchDrafts]);

  const createDraft = useCallback(async (
    draftData: Omit<Draft, 'draft_id' | 'user_id' | 'created_at' | 'updated_at'>
  ): Promise<boolean> => {
    try {
      const response = await puppeteerApiService.createDraft(draftData);
      
      if (response.success && response.data) {
        setDrafts(prev => [...prev, response.data!]);
        return true;
      } else {
        setError(response.error || 'Failed to create draft');
        return false;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      return false;
    }
  }, []);

  return {
    drafts,
    loading,
    error,
    refetch: fetchDrafts,
    createDraft,
  };
};
