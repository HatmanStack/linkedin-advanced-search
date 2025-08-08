import { useState, useEffect, useCallback } from 'react';
import { puppeteerApiService, Message } from '@/services/puppeteerApiService';
import { useAuth } from '@/contexts/AuthContext';

export const useMessages = (connectionId?: string) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMessages = useCallback(async () => {
    if (!user) {
      setMessages([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const response = await puppeteerApiService.getMessages({ connectionId });
      
      if (response.success && response.data) {
        setMessages(response.data.messages || []);
      } else {
        setError(response.error || 'Failed to fetch messages');
        setMessages([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setMessages([]);
    } finally {
      setLoading(false);
    }
  }, [user, connectionId]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  const createMessage = useCallback(async (
    messageData: Omit<Message, 'message_id' | 'user_id' | 'created_at' | 'updated_at'>
  ): Promise<boolean> => {
    try {
      const response = await puppeteerApiService.createMessage(messageData);
      
      if (response.success && response.data) {
        setMessages(prev => [...prev, response.data!]);
        return true;
      } else {
        setError(response.error || 'Failed to create message');
        return false;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      return false;
    }
  }, []);

  return {
    messages,
    loading,
    error,
    refetch: fetchMessages,
    createMessage,
  };
};
