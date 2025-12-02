import { vi } from 'vitest';
import type { PuppeteerApiResponse } from '@/shared/types';

export const mockSearchResult = {
  id: 'search-result-1',
  name: 'John Doe',
  title: 'Software Engineer',
  company: 'Tech Corp',
  location: 'San Francisco, CA',
  profileUrl: 'https://linkedin.com/in/johndoe',
};

export const mockConnection = {
  id: 'conn-1',
  profileId: 'profile-123',
  name: 'Jane Smith',
  title: 'Product Manager',
  company: 'Startup Inc',
  status: 'possible' as const,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

export const mockMessage = {
  id: 'msg-1',
  connectionId: 'conn-1',
  content: 'Hello!',
  timestamp: new Date().toISOString(),
  isSent: true,
};

export const mockPuppeteerApiService = {
  getConnections: vi.fn().mockResolvedValue({
    success: true,
    data: { connections: [mockConnection] },
  } as PuppeteerApiResponse<{ connections: unknown[] }>),
  createConnection: vi.fn().mockResolvedValue({ success: true, data: mockConnection }),
  updateConnection: vi.fn().mockResolvedValue({ success: true }),
  getMessages: vi.fn().mockResolvedValue({
    success: true,
    data: { messages: [mockMessage] },
  }),
  createMessage: vi.fn().mockResolvedValue({ success: true, data: mockMessage }),
  getTopics: vi.fn().mockResolvedValue({ success: true, data: [] }),
  createTopic: vi.fn().mockResolvedValue({ success: true }),
  getDrafts: vi.fn().mockResolvedValue({ success: true, data: [] }),
  createDraft: vi.fn().mockResolvedValue({ success: true }),
  performLinkedInSearch: vi.fn().mockResolvedValue({
    success: true,
    data: [mockSearchResult],
    message: 'Found 1 result',
  }),
  searchLinkedIn: vi.fn().mockResolvedValue({
    success: true,
    data: [mockSearchResult],
    message: 'Found 1 result',
  }),
  generateMessage: vi.fn().mockResolvedValue({
    success: true,
    data: { message: 'Generated message content' },
  }),
  sendLinkedInMessage: vi.fn().mockResolvedValue({
    success: true,
    data: { messageId: 'msg-123', deliveryStatus: 'sent' },
  }),
  addLinkedInConnection: vi.fn().mockResolvedValue({
    success: true,
    data: { connectionRequestId: 'req-123', status: 'pending' },
  }),
  createLinkedInPost: vi.fn().mockResolvedValue({
    success: true,
    data: { postId: 'post-123', postUrl: 'https://linkedin.com/post/123', publishStatus: 'published' },
  }),
  authorizeHealAndRestore: vi.fn().mockResolvedValue({ success: true }),
  checkHealAndRestoreStatus: vi.fn().mockResolvedValue({ success: true }),
  cancelHealAndRestore: vi.fn().mockResolvedValue({ success: true }),
  initializeProfileDatabase: vi.fn().mockResolvedValue({ success: true }),
};

export const mockLambdaApiService = {
  getConnectionsByStatus: vi.fn().mockResolvedValue([mockConnection]),
  updateConnectionStatus: vi.fn().mockResolvedValue(undefined),
  getMessageHistory: vi.fn().mockResolvedValue([mockMessage]),
  getUserProfile: vi.fn().mockResolvedValue({ success: true, data: {} }),
  updateUserProfile: vi.fn().mockResolvedValue({ success: true, data: {} }),
  createUserProfile: vi.fn().mockResolvedValue({ success: true, data: {} }),
  callProfilesOperation: vi.fn().mockResolvedValue({ success: true }),
  searchProfiles: vi.fn().mockResolvedValue({
    success: true,
    results: [],
    total: 0,
  }),
  sendLLMRequest: vi.fn().mockResolvedValue({ success: true }),
  clearAuthToken: vi.fn(),
};

export const resetApiMocks = () => {
  Object.values(mockPuppeteerApiService).forEach((mock) => mock.mockReset());
  Object.values(mockLambdaApiService).forEach((mock) => mock.mockReset());

  mockPuppeteerApiService.getConnections.mockResolvedValue({
    success: true,
    data: { connections: [mockConnection] },
  });
  mockPuppeteerApiService.performLinkedInSearch.mockResolvedValue({
    success: true,
    data: [mockSearchResult],
    message: 'Found 1 result',
  });
  mockPuppeteerApiService.searchLinkedIn.mockResolvedValue({
    success: true,
    data: [mockSearchResult],
    message: 'Found 1 result',
  });
  mockLambdaApiService.getConnectionsByStatus.mockResolvedValue([mockConnection]);
};

export const createMockPuppeteerApiService = () => ({
  puppeteerApiService: mockPuppeteerApiService,
  default: mockPuppeteerApiService,
});

export const createMockLambdaApiService = () => ({
  lambdaApiService: mockLambdaApiService,
  default: mockLambdaApiService,
  ApiError: class ApiError extends Error {
    status?: number;
    code?: string;
    constructor({ message, status, code }: { message: string; status?: number; code?: string }) {
      super(message);
      this.status = status;
      this.code = code;
    }
  },
});
