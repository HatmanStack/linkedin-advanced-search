// Messages feature barrel export

// Components
export { MessageModal } from './components/MessageModal';
export { default as ConversationTopicPanel } from './components/ConversationTopicPanel';

// Hooks
export { useMessages } from './hooks/useMessages';

// Services
export { messageGenerationService, MessageGenerationError } from './services/messageGenerationService';
export type { MessageGenerationRequest } from './services/messageGenerationService';
