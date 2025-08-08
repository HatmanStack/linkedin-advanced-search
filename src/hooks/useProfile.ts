import { useState, useEffect, useCallback } from 'react';
import { puppeteerApiService, UserProfile } from '@/services/puppeteerApiService';
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
      
      const response = await puppeteerApiService.getUserProfile();
      
      if (response.success && response.data) {
        setProfile(response.data);
      } else {
        setError(response.error || 'Failed to fetch profile');
        setProfile(null);
      }
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
      const response = await puppeteerApiService.updateUserProfile(updates);
      
      if (response.success && response.data) {
        setProfile(response.data);
        return true;
      } else {
        setError(response.error || 'Failed to update profile');
        return false;
      }
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
