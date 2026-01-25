export const queryKeys = {
  connections: {
    all: ['connections'] as const,
    byStatus: (status: string) => ['connections', 'status', status] as const,
    byUser: (userId: string) => ['connections', 'user', userId] as const,
  },
  search: {
    results: ['search', 'results'] as const,
    visited: ['search', 'visited'] as const,
  },
  messages: {
    history: (connectionId: string) => ['messages', 'history', connectionId] as const,
  },
} as const;
