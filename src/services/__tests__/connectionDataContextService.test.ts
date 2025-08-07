import { describe, it, expect, beforeEach } from 'vitest';
import { ConnectionDataContextService } from '../connectionDataContextService';
import type { Connection, Message } from '../../types/index';
import type { UserProfile } from '../apiService';

describe('ConnectionDataContextService - Task 11 Core Functionality', () => {
  let service: ConnectionDataContextService;

  const mockConnection: Connection = {
    id: 'conn-123',
    first_name: 'John',
    last_name: 'Doe',
    position: 'Software Engineer',
    company: 'Tech Corp',
    headline: 'Passionate about technology and innovation',
    tags: ['tech', 'innovation', 'ai'],
    common_interests: ['machine learning', 'startups'],
    status: 'allies',
    message_history: [
      {
        id: 'msg-1',
        content: 'Hello, nice to connect!',
        timestamp: '2024-01-15T10:00:00Z',
        sender: 'user',
      },
      {
        id: 'msg-2',
        content: 'Thanks for reaching out!',
        timestamp: '2024-01-15T10:30:00Z',
        sender: 'connection',
      },
      {
        id: 'msg-3',
        content: 'Looking forward to collaborating',
        timestamp: '2024-01-15T11:00:00Z',
        sender: 'user',
      },
    ],
  };

  const mockUserProfile: UserProfile = {
    user_id: 'user-123',
    first_name: 'Jane',
    last_name: 'Smith',
    email: 'jane@example.com',
    headline: 'Product Manager at StartupCo',
    current_position: 'Senior Product Manager',
    company: 'StartupCo',
    industry: 'Technology',
    interests: ['product development', 'machine learning', 'user experience'],
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-15T00:00:00Z',
    preferences: {},
  };

  beforeEach(() => {
    service = new ConnectionDataContextService();
  });

  describe('Connection Profile Data Extraction (Requirement 5.1)', () => {
    it('should extract relevant connection profile data for API calls', () => {
      const profileData = service.extractConnectionProfileData(mockConnection);

      expect(profileData).toEqual({
        firstName: 'John',
        lastName: 'Doe',
        position: 'Software Engineer',
        company: 'Tech Corp',
        headline: 'Passionate about technology and innovation',
        tags: ['tech', 'innovation', 'ai', 'machine learning', 'startups'],
      });
    });

    it('should handle missing optional fields gracefully', () => {
      const connectionWithoutOptionals: Connection = {
        ...mockConnection,
        headline: undefined,
        tags: undefined,
        common_interests: undefined,
      };

      const profileData = service.extractConnectionProfileData(connectionWithoutOptionals);

      expect(profileData).toEqual({
        firstName: 'John',
        lastName: 'Doe',
        position: 'Software Engineer',
        company: 'Tech Corp',
        headline: undefined,
        tags: [],
      });
    });
  });

  describe('Message History Retrieval and Formatting (Requirement 5.2)', () => {
    it('should prepare and format message history correctly', () => {
      const messageHistory = service.prepareMessageHistory(mockConnection, 10);

      expect(messageHistory).toHaveLength(3);
      expect(messageHistory[0]).toEqual({
        id: 'msg-3',
        content: 'Looking forward to collaborating',
        timestamp: '2024-01-15T11:00:00Z',
        sender: 'user',
      });
      // Should be sorted by timestamp (most recent first)
      expect(new Date(messageHistory[0].timestamp).getTime())
        .toBeGreaterThan(new Date(messageHistory[1].timestamp).getTime());
    });

    it('should limit message history to specified maximum', () => {
      const messageHistory = service.prepareMessageHistory(mockConnection, 2);

      expect(messageHistory).toHaveLength(2);
      expect(messageHistory[0].id).toBe('msg-3'); // Most recent
      expect(messageHistory[1].id).toBe('msg-2'); // Second most recent
    });

    it('should return empty array when no message history exists', () => {
      const connectionWithoutHistory: Connection = {
        ...mockConnection,
        message_history: undefined,
      };

      const messageHistory = service.prepareMessageHistory(connectionWithoutHistory);

      expect(messageHistory).toEqual([]);
    });

    it('should filter out invalid messages', () => {
      const connectionWithInvalidMessages: Connection = {
        ...mockConnection,
        message_history: [
          {
            id: 'msg-1',
            content: 'Valid message',
            timestamp: '2024-01-15T10:00:00Z',
            sender: 'user',
          },
          {
            id: '',
            content: 'Invalid message - no ID',
            timestamp: '2024-01-15T10:30:00Z',
            sender: 'user',
          } as Message,
          {
            id: 'msg-3',
            content: '',
            timestamp: '2024-01-15T11:00:00Z',
            sender: 'user',
          } as Message,
        ],
      };

      const messageHistory = service.prepareMessageHistory(connectionWithInvalidMessages);

      expect(messageHistory).toHaveLength(1);
      expect(messageHistory[0].id).toBe('msg-1');
    });
  });

  describe('User Profile Data Inclusion (Requirement 5.3)', () => {
    it('should prepare user profile data for API inclusion', () => {
      const preparedProfile = service.prepareUserProfileData(mockUserProfile);

      expect(preparedProfile).toEqual({
        user_id: 'user-123',
        first_name: 'Jane',
        last_name: 'Smith',
        email: 'jane@example.com',
        headline: 'Product Manager at StartupCo',
        current_position: 'Senior Product Manager',
        company: 'StartupCo',
        industry: 'Technology',
        interests: ['product development', 'machine learning', 'user experience'],
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-15T00:00:00Z',
        preferences: {},
      });
    });

    it('should handle missing optional profile fields', () => {
      const incompleteProfile: UserProfile = {
        user_id: 'user-123',
        email: 'jane@example.com',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-15T00:00:00Z',
        interests: [],
        preferences: {},
      };

      const preparedProfile = service.prepareUserProfileData(incompleteProfile);

      expect(preparedProfile.first_name).toBe('');
      expect(preparedProfile.last_name).toBe('');
      expect(preparedProfile.headline).toBe('');
      expect(preparedProfile.interests).toEqual([]);
    });
  });

  describe('Conversation Topic and Tags Context Preparation (Requirement 5.4)', () => {
    it('should prepare conversation topic correctly', () => {
      const topic = service.prepareConversationTopic('  AI and machine learning trends  ');

      expect(topic).toBe('AI and machine learning trends');
    });

    it('should normalize whitespace in conversation topic', () => {
      const topic = service.prepareConversationTopic('AI   and    machine\n\nlearning');

      expect(topic).toBe('AI and machine learning');
    });

    it('should throw error for invalid conversation topic', () => {
      expect(() => service.prepareConversationTopic('')).toThrow('Conversation topic is required');
      expect(() => service.prepareConversationTopic('   ')).toThrow('Conversation topic is required');
    });

    it('should prepare connection tags and common interests', () => {
      const tags = service.prepareConnectionTags(mockConnection);

      expect(tags).toEqual(['tech', 'innovation', 'ai', 'machine learning', 'startups']);
    });

    it('should remove duplicate tags', () => {
      const connectionWithDuplicates: Connection = {
        ...mockConnection,
        tags: ['tech', 'ai', 'innovation'],
        common_interests: ['ai', 'tech', 'startups'],
      };

      const tags = service.prepareConnectionTags(connectionWithDuplicates);

      expect(tags).toEqual(['tech', 'ai', 'innovation', 'startups']);
    });

    it('should filter out empty tags', () => {
      const connectionWithEmptyTags: Connection = {
        ...mockConnection,
        tags: ['tech', '', '  ', 'ai'],
        common_interests: ['startups', ''],
      };

      const tags = service.prepareConnectionTags(connectionWithEmptyTags);

      expect(tags).toEqual(['tech', 'ai', 'startups']);
    });
  });

  describe('Complete Context Preparation', () => {
    it('should prepare complete message generation context', () => {
      const context = service.prepareMessageGenerationContext(
        mockConnection,
        'AI and machine learning trends',
        mockUserProfile
      );

      expect(context.connection).toBe(mockConnection);
      expect(context.topic).toBe('AI and machine learning trends');
      expect(context.messageHistory).toHaveLength(3);
      expect(context.userProfile.user_id).toBe('user-123');
      expect(context.previousMessages).toEqual([]);
    });

    it('should create complete MessageGenerationRequest from context', () => {
      const context = service.prepareMessageGenerationContext(
        mockConnection,
        'AI trends',
        mockUserProfile
      );

      const request = service.createMessageGenerationRequest(context);

      expect(request).toEqual({
        connectionId: 'conn-123',
        connectionProfile: {
          firstName: 'John',
          lastName: 'Doe',
          position: 'Software Engineer',
          company: 'Tech Corp',
          headline: 'Passionate about technology and innovation',
          tags: ['tech', 'innovation', 'ai', 'machine learning', 'startups'],
        },
        conversationTopic: 'AI trends',
        messageHistory: expect.any(Array),
        userProfile: expect.objectContaining({
          user_id: 'user-123',
          first_name: 'Jane',
          last_name: 'Smith',
        }),
      });
    });
  });

  describe('Common Interests and Context Analysis', () => {
    it('should find common interests between user and connection', () => {
      const commonInterests = service.findCommonInterests(mockUserProfile, mockConnection);

      expect(commonInterests).toEqual(['machine learning']);
    });

    it('should calculate context relevance score', () => {
      const context = service.prepareMessageGenerationContext(
        mockConnection,
        'AI and machine learning trends',
        mockUserProfile
      );

      const relevanceScore = service.calculateContextRelevance(context);

      expect(relevanceScore).toBeGreaterThan(0);
      expect(relevanceScore).toBeLessThanOrEqual(1);
    });

    it('should return zero relevance for minimal context', () => {
      const minimalConnection: Connection = {
        id: 'conn-minimal',
        first_name: 'Test',
        last_name: 'User',
        position: 'Unknown',
        company: 'Unknown',
        status: 'allies',
      };

      const context = service.prepareMessageGenerationContext(
        minimalConnection,
        'Hi',
        undefined
      );

      const relevanceScore = service.calculateContextRelevance(context);

      expect(relevanceScore).toBe(0);
    });
  });
});
