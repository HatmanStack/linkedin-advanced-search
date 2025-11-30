import { describe, it, expect } from 'vitest';
import { ConnectionDataContextService } from '@/features/connections';
import type { Connection, UserProfile } from '@/shared/types';

describe('ConnectionDataContextService', () => {
  const service = new ConnectionDataContextService();

  const mockConnection: Connection = {
    id: 'conn-1',
    first_name: 'John',
    last_name: 'Doe',
    position: 'Software Engineer',
    company: 'Tech Corp',
    headline: 'Building great software',
    profile_url: 'https://linkedin.com/in/john',
    connected_at: '2024-01-01',
  } as Connection;

  const mockUserProfile: UserProfile = {
    user_id: 'user-123',
    first_name: 'Jane',
    last_name: 'Smith',
    email: 'jane@example.com',
  } as UserProfile;

  describe('prepareMessageGenerationContext', () => {
    it('should prepare complete context with all options', () => {
      const context = service.prepareMessageGenerationContext(
        mockConnection,
        'React development',
        mockUserProfile
      );

      expect(context.connection).toEqual(mockConnection);
      expect(context.topic).toBe('React development');
      expect(context.userProfile).toBeDefined();
      expect(context.messageHistory).toEqual([]);
      expect(context.previousMessages).toEqual([]);
    });

    it('should exclude user profile when option is false', () => {
      const context = service.prepareMessageGenerationContext(
        mockConnection,
        'test',
        mockUserProfile,
        { includeUserProfile: false }
      );

      expect(context.userProfile).toEqual({});
    });

    it('should handle previous messages', () => {
      const context = service.prepareMessageGenerationContext(
        mockConnection,
        'test',
        undefined,
        { previousMessages: ['msg1', 'msg2'] }
      );

      expect(context.previousMessages).toEqual(['msg1', 'msg2']);
    });
  });

  describe('extractConnectionProfileData', () => {
    it('should extract required connection fields', () => {
      const profileData = service.extractConnectionProfileData(mockConnection);

      expect(profileData.firstName).toBe('John');
      expect(profileData.lastName).toBe('Doe');
      expect(profileData.position).toBe('Software Engineer');
      expect(profileData.company).toBe('Tech Corp');
    });
  });

  describe('prepareConversationTopic', () => {
    it('should trim and validate topic', () => {
      const topic = service.prepareConversationTopic('  React dev  ');
      expect(topic).toBe('React dev');
    });

    it('should handle empty topic', () => {
      expect(() => service.prepareConversationTopic('')).toThrow('Conversation topic is required and must be a string');
    });
  });

  describe('prepareUserProfileData', () => {
    it('should filter out sensitive fields', () => {
      const profileData = service.prepareUserProfileData(mockUserProfile);
      expect(profileData).toBeDefined();
      expect(profileData.user_id).toBe('user-123');
    });
  });
});
