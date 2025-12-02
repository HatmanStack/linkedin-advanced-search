import type { User } from '@/features/auth/contexts/AuthContext';
import type { Connection, Message } from '@/shared/types';

let userCounter = 0;
let connectionCounter = 0;
let messageCounter = 0;

export const createMockUser = (overrides: Partial<User> = {}): User => {
  userCounter++;
  return {
    id: `user-${userCounter}`,
    email: `user${userCounter}@example.com`,
    firstName: 'Test',
    lastName: 'User',
    emailVerified: true,
    ...overrides,
  };
};

export const createMockConnection = (
  overrides: Partial<Connection> = {}
): Connection => {
  connectionCounter++;
  const now = new Date().toISOString();
  return {
    id: `connection-${connectionCounter}`,
    first_name: 'Test',
    last_name: `User${connectionCounter}`,
    position: 'Software Engineer',
    company: 'Tech Company',
    location: 'San Francisco, CA',
    headline: 'Building great software',
    status: 'possible',
    date_added: now,
    linkedin_url: `https://linkedin.com/in/testuser${connectionCounter}`,
    tags: [],
    conversion_likelihood: 75,
    ...overrides,
  };
};

export const createMockMessage = (overrides: Partial<Message> = {}): Message => {
  messageCounter++;
  return {
    id: `msg-${messageCounter}`,
    content: `Test message ${messageCounter}`,
    timestamp: new Date().toISOString(),
    sender: 'user',
    ...overrides,
  };
};

export const createMockSearchResult = (overrides: Record<string, unknown> = {}) => {
  const counter = connectionCounter++;
  return {
    id: `search-${counter}`,
    name: `Search Result ${counter}`,
    title: 'Product Manager',
    company: 'Tech Company',
    location: 'San Francisco, CA',
    profileUrl: `https://linkedin.com/in/result${counter}`,
    ...overrides,
  };
};

export const resetFactoryCounters = () => {
  userCounter = 0;
  connectionCounter = 0;
  messageCounter = 0;
};
