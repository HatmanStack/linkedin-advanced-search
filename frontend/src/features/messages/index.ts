// Messages feature barrel export

// Components
export { default as MessageModal } from './components/MessageModal';
export { default as ConversationTopicPanel } from './components/ConversationTopicPanel';

// Services
export {
  messageGenerationService,
  MessageGenerationError,
} from './services/messageGenerationService';

// Hooks
export { useMessageGeneration } from './hooks/useMessageGeneration';
export { useWorkflowStateMachine } from './hooks/useWorkflowStateMachine';
export { useMessageModal } from './hooks/useMessageModal';
export { useMessageHistory } from './hooks/useMessageHistory';

// Types
export type { MessageGenerationRequest } from './services/messageGenerationService';
export type { WorkflowState } from './hooks/useWorkflowStateMachine';
