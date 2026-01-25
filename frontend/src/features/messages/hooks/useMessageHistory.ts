import { useState, useCallback } from 'react';
import type { Message } from '@/types';

export function useMessageHistory() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = useCallback(async (_connectionId: string | null) => {
    if (!_connectionId) {
      setMessages([]);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      // Message history fetching - currently returns empty (matches original behavior)
      // Real implementation would fetch from API
      setMessages([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load messages');
      setMessages([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const addMessage = useCallback((message: Message) => {
    setMessages((prev) => [...prev, message]);
  }, []);

  const clearHistory = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  return {
    messages,
    isLoading,
    error,
    fetchHistory,
    addMessage,
    clearHistory,
  };
}
