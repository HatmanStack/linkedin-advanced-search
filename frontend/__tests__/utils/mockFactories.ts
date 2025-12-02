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
    profileId: `profile-${connectionCounter}`,
    name: `Connection ${connectionCounter}`,
    headline: 'Software Engineer',
    photoUrl: `https://example.com/photo${connectionCounter}.jpg`,
    profileUrl: `https://linkedin.com/in/connection${connectionCounter}`,
    status: 'possible',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  } as Connection;
};

export const createMockMessage = (overrides: Partial<Message> = {}): Message => {
  messageCounter++;
  return {
    id: `msg-${messageCounter}`,
    recipientProfileId: `profile-${messageCounter}`,
    messageContent: `Test message ${messageCounter}`,
    timestamp: new Date().toISOString(),
    status: 'sent',
    ...overrides,
  } as Message;
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
