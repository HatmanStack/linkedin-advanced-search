import { useState, useEffect, useCallback } from 'react';
import type { UserProfile } from '@/types';
import { useAuth } from '@/contexts/AuthContext';

export const useProfile = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = useCallback(async () => {
    if (!user) {
      setProfile(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      // Profile fetching removed - puppeteerApiService no longer handles profile endpoints
      // Use lambdaApiService or UserProfileContext instead
      setError('Profile fetching through puppeteerApiService is deprecated');
      setProfile(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const updateProfile = useCallback(async (updates: Partial<UserProfile>): Promise<boolean> => {
    try {
      // Profile updating removed - puppeteerApiService no longer handles profile endpoints
      // Use lambdaApiService or UserProfileContext instead
      setError('Profile updating through puppeteerApiService is deprecated');
      return false;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      return false;
    }
  }, []);

  return {
    profile,
    loading,
    error,
    refetch: fetchProfile,
    updateProfile,
  };
};
