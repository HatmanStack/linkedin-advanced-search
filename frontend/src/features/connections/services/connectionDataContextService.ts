import type { Connection, Message } from '@/shared/types/index';
import type { UserProfile } from '@/shared/types';
import type { MessageGenerationRequest } from '@/features/messages';


export interface MessageGenerationContext {
  
  connection: Connection;
  
  topic: string;
  
  messageHistory: Message[];
  
  userProfile: UserProfile;
  
  previousMessages: string[];
}


export interface ContextPreparationOptions {
  
  includeMessageHistory?: boolean;
  
  maxMessageHistory?: number;
  
  includeUserProfile?: boolean;
  
  includeTags?: boolean;
  
  previousMessages?: string[];
}


export class ConnectionDataContextService {
  
  
  prepareMessageGenerationContext(
    connection: Connection,
    conversationTopic: string,
    userProfile?: UserProfile,
    options: ContextPreparationOptions = {}
  ): MessageGenerationContext {
    const {
      includeMessageHistory = true,
      maxMessageHistory = 10,
      includeUserProfile = true,
      previousMessages = []
    } = options;

    return {
      connection,
      topic: this.prepareConversationTopic(conversationTopic),
      messageHistory: includeMessageHistory 
        ? this.prepareMessageHistory(connection, maxMessageHistory)
        : [],
      userProfile: includeUserProfile && userProfile 
        ? this.prepareUserProfileData(userProfile)
        : {} as UserProfile,
      previousMessages: [...previousMessages],
    };
  }

  
  extractConnectionProfileData(connection: Connection): {
    firstName: string;
    lastName: string;
    position: string;
    company: string;
    headline?: string;
    tags?: string[];
  } {
    return {
      firstName: connection.first_name,
      lastName: connection.last_name,
      position: connection.position,
      company: connection.company,
      headline: connection.headline,
      tags: this.prepareConnectionTags(connection),
    };
  }

  
  prepareMessageHistory(connection: Connection, maxMessages: number = 10): Message[] {
    if (!connection.message_history || connection.message_history.length === 0) {
      return [];
    }

    const sortedMessages = [...connection.message_history]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, maxMessages);

    return sortedMessages
      .filter(message => this.isValidMessage(message))
      .map(message => this.sanitizeMessage(message));
  }

  
  prepareUserProfileData(userProfile: UserProfile): UserProfile {
    return {
      user_id: userProfile.user_id,
      first_name: userProfile.first_name || '',
      last_name: userProfile.last_name || '',
      email: userProfile.email,
      headline: userProfile.headline || '',
      current_position: userProfile.current_position || '',
      company: userProfile.company || '',
      industry: userProfile.industry || '',
      interests: userProfile.interests || [],
      created_at: userProfile.created_at,
      updated_at: userProfile.updated_at,
    };
  }

  
  prepareConversationTopic(topic: string): string {
    if (!topic || typeof topic !== 'string') {
      throw new Error('Conversation topic is required and must be a string');
    }

    const cleanedTopic = topic.trim().replace(/\s+/g, ' ');
    
    if (cleanedTopic.length === 0) {
      throw new Error('Conversation topic is required and must be a string');
    }

    return cleanedTopic;
  }

  
  prepareConnectionTags(connection: Connection): string[] {
    const tags: string[] = [];

    if (connection.tags && Array.isArray(connection.tags)) {
      tags.push(...connection.tags);
    }

    if (connection.common_interests && Array.isArray(connection.common_interests)) {
      tags.push(...connection.common_interests);
    }

    return [...new Set(tags.filter(tag => tag && tag.trim().length > 0))];
  }

  
  createMessageGenerationRequest(context: MessageGenerationContext): MessageGenerationRequest {
    return {
      connectionId: context.connection.id,
      connectionProfile: this.extractConnectionProfileData(context.connection),
      conversationTopic: context.topic,
      messageHistory: context.messageHistory,
      userProfile: context.userProfile,
    };
  }

  
  private isValidMessage(message: Message): boolean {
    return !!(
      message &&
      message.id &&
      message.content &&
      message.timestamp &&
      message.sender
    );
  }

  
  private sanitizeMessage(message: Message): Message {
    return {
      id: message.id,
      content: message.content.trim(),
      timestamp: message.timestamp,
      sender: message.sender,
    };
  }

  
  findCommonInterests(userProfile: UserProfile, connection: Connection): string[] {
    if (!userProfile.interests || !connection.common_interests) {
      return [];
    }

    const userInterests = userProfile.interests.map(interest => interest.toLowerCase());
    const connectionInterests = connection.common_interests.map(interest => interest.toLowerCase());

    return userInterests.filter(interest => 
      connectionInterests.includes(interest)
    );
  }

  
  calculateContextRelevance(context: MessageGenerationContext): number {
    let score = 0;
    let factors = 0;

    if (context.topic && context.topic.length > 10) {
      score += 0.3;
    }
    factors++;

    if (context.messageHistory.length > 0) {
      score += 0.2;
    }
    factors++;

    if (context.userProfile && context.userProfile.headline && context.userProfile.company) {
      score += 0.2;
    }
    factors++;

    if (context.connection.headline && context.connection.position) {
      score += 0.2;
    }
    factors++;

    const commonInterests = this.findCommonInterests(context.userProfile, context.connection);
    if (commonInterests.length > 0) {
      score += 0.1;
    }
    factors++;

    return factors > 0 ? score : 0;
  }
}


export const connectionDataContextService = new ConnectionDataContextService();

