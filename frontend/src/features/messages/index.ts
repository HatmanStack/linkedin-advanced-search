// Messages feature barrel export

// Components
export { default as MessageModal } from './components/MessageModal';
export { default as ConversationTopicPanel } from './components/ConversationTopicPanel';

// Hooks
export { useMessages } from './hooks/useMessages';

// Services
export { messageGenerationService, MessageGenerationError } from './services/messageGenerationService';

// Types
export type { MessageGenerationRequest, MessageGenerationResponse } from './services/messageGenerationService';
