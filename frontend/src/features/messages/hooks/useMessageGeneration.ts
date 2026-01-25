import { useState, useCallback, useMemo } from 'react';
import { useToast } from '@/shared/hooks';
import { useErrorHandler } from '@/shared/hooks';
import { useProgressTracker } from '@/features/workflow';
import { messageGenerationService } from '@/features/messages';
import { connectionDataContextService } from '@/features/connections';
import type { Connection, Message } from '@/types';
import { createLogger } from '@/shared/utils/logger';

const logger = createLogger('useMessageGeneration');

type WorkflowState = 'idle' | 'generating' | 'awaiting_approval' | 'stopping' | 'completed' | 'error';

interface UseMessageGenerationOptions {
  connections: Connection[];
  selectedConnections: string[];
  conversationTopic: string;
  userProfile: Record<string, unknown> | null;
}

export function useMessageGeneration({
  connections,
  selectedConnections,
  conversationTopic,
  userProfile,
}: UseMessageGenerationOptions) {
  const { toast } = useToast();
  const errorHandler = useErrorHandler();
  const progressTracker = useProgressTracker();

  const [isGeneratingMessages, setIsGeneratingMessages] = useState(false);
  const [currentConnectionIndex, setCurrentConnectionIndex] = useState(0);
  const [generatedMessages, setGeneratedMessages] = useState<Map<string, string>>(new Map());
  const [workflowState, setWorkflowState] = useState<WorkflowState>('idle');

  // Message modal state
  const [messageModalOpen, setMessageModalOpen] = useState(false);
  const [selectedConnectionForMessages, setSelectedConnectionForMessages] = useState<Connection | null>(null);
  const [messageHistory, setMessageHistory] = useState<Message[]>([]);

  const resetWorkflowState = useCallback(() => {
    setIsGeneratingMessages(false);
    setCurrentConnectionIndex(0);
    setGeneratedMessages(new Map());
    setWorkflowState('idle');
  }, []);

  const handleMessageClick = useCallback(async (connection: Connection) => {
    setSelectedConnectionForMessages(connection);
    setMessageModalOpen(true);
    try {
      const messages: Message[] = [];
      setMessageHistory(messages);
    } catch (err: unknown) {
      logger.error('Error fetching message history', { error: err });
      toast({ title: "Failed to Load Messages", description: "Could not load message history.", variant: "destructive" });
      setMessageHistory([]);
    }
  }, [toast]);

  const handleCloseMessageModal = useCallback(() => {
    setMessageModalOpen(false);
    setSelectedConnectionForMessages(null);
    setMessageHistory([]);
  }, []);

  const handleSendMessage = useCallback(async (message: string): Promise<void> => {
    logger.info('Sending message', { message, connectionId: selectedConnectionForMessages?.id });
    toast({ title: "Message Sending Not Implemented", description: "Message sending functionality will be available in a future update.", variant: "default" });
    if (selectedConnectionForMessages) {
      const newMessage: Message = { id: `msg-${Date.now()}`, content: message, timestamp: new Date().toISOString(), sender: 'user' };
      setMessageHistory(prev => [...prev, newMessage]);
    }
  }, [selectedConnectionForMessages, toast]);

  const generateMessageForConnection = useCallback(async (connection: Connection): Promise<string> => {
    const cleanedTopic = connectionDataContextService.prepareConversationTopic(conversationTopic);
    const connectionWithHistory = { ...connection, message_history: messageHistory } as Connection;
    const context = connectionDataContextService.prepareMessageGenerationContext(
      connectionWithHistory, cleanedTopic, userProfile || undefined, { includeMessageHistory: true }
    );
    const request = connectionDataContextService.createMessageGenerationRequest(context);
    return messageGenerationService.generateMessage(request);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationTopic, userProfile]);

  const waitForUserApproval = useCallback((): Promise<void> => {
    return new Promise((resolve) => {
      const checkApproval = () => {
        if (workflowState !== 'awaiting_approval') resolve();
        else setTimeout(checkApproval, 100);
      };
      checkApproval();
    });
  }, [workflowState]);

  const processSelectedConnections = useCallback(async () => {
    if (selectedConnections.length === 0 || !conversationTopic.trim()) {
      errorHandler.showWarningFeedback('Please select connections and enter a conversation topic.', 'Missing Requirements');
      return;
    }

    logger.info('Starting message generation workflow', { connectionCount: selectedConnections.length });
    progressTracker.initializeProgress(selectedConnections.length);
    progressTracker.setLoadingMessage('Preparing message generation...', 0, true);

    setWorkflowState('generating');
    setIsGeneratingMessages(true);
    setCurrentConnectionIndex(0);
    errorHandler.clearError();

    const selectedConnectionsData = connections.filter(conn =>
      selectedConnections.includes(conn.id) && conn.status === 'ally'
    );

    for (let i = 0; i < selectedConnectionsData.length; i++) {
      if (workflowState === 'stopping') {
        progressTracker.resetProgress();
        break;
      }

      setCurrentConnectionIndex(i);
      const connection = selectedConnectionsData[i];
      const connectionName = `${connection.first_name} ${connection.last_name}`;

      progressTracker.updateProgress(i, connectionName, 'generating');
      progressTracker.setLoadingMessage(`Generating message for ${connectionName}...`,
        Math.round((i / selectedConnectionsData.length) * 100), true);

      let retryCount = 0;
      let shouldContinue = true;

      while (shouldContinue) {
        try {
          const generatedMessage = await generateMessageForConnection(connection);
          setGeneratedMessages(prev => new Map(prev).set(connection.id, generatedMessage));

          progressTracker.updateProgress(i, connectionName, 'waiting_approval');
          setWorkflowState('awaiting_approval');
          setSelectedConnectionForMessages(connection);
          setMessageModalOpen(true);

          await waitForUserApproval();
          break;
        } catch (error) {
          logger.error('Error generating message', { connectionId: connection.id, error });
          const recoveryAction = await errorHandler.handleError(error, connection.id, connectionName, retryCount);

          switch (recoveryAction) {
            case 'retry':
              retryCount++;
              progressTracker.setLoadingMessage(`Retrying for ${connectionName}... (Attempt ${retryCount + 1})`,
                Math.round((i / selectedConnectionsData.length) * 100), true);
              continue;
            case 'skip':
              errorHandler.showInfoFeedback(`Skipped ${connectionName} due to error.`, 'Connection Skipped');
              shouldContinue = false;
              break;
            case 'stop':
              progressTracker.resetProgress();
              setWorkflowState('error');
              setIsGeneratingMessages(false);
              return;
          }
        }
      }
    }

    logger.info('Message generation workflow completed');
    progressTracker.updateProgress(selectedConnectionsData.length, undefined, 'completed');
    errorHandler.showSuccessFeedback(`Successfully generated messages for ${selectedConnectionsData.length} connections.`, 'Generation Complete');
    setWorkflowState('completed');

    setTimeout(() => {
      resetWorkflowState();
      progressTracker.resetProgress();
    }, 2000);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedConnections, conversationTopic, connections, workflowState, errorHandler, progressTracker]);

  const handleStopGeneration = useCallback(() => {
    setWorkflowState('stopping');
    setIsGeneratingMessages(false);
    progressTracker.resetProgress();
    if (messageModalOpen) {
      setMessageModalOpen(false);
      setSelectedConnectionForMessages(null);
    }
    resetWorkflowState();
    errorHandler.showInfoFeedback('Message generation has been stopped.', 'Generation Stopped');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messageModalOpen, progressTracker, errorHandler]);

  const handleGenerateMessages = useCallback(() => {
    if (selectedConnections.length === 0 || !conversationTopic.trim()) {
      toast({ title: "Missing Requirements", description: "Please select connections and enter a conversation topic.", variant: "destructive" });
      return;
    }
    processSelectedConnections();
  }, [selectedConnections, conversationTopic, processSelectedConnections, toast]);

  const handleApproveAndNext = useCallback(() => {
    setWorkflowState('generating');
    setMessageModalOpen(false);
    setSelectedConnectionForMessages(null);
  }, []);

  const handleSkipConnection = useCallback(() => {
    setWorkflowState('generating');
    setMessageModalOpen(false);
    setSelectedConnectionForMessages(null);
  }, []);

  const currentConnectionName = useMemo(() => {
    if (!isGeneratingMessages || currentConnectionIndex >= selectedConnections.length) return undefined;
    const currentConnectionId = selectedConnections[currentConnectionIndex];
    const connection = connections.find(conn => conn.id === currentConnectionId);
    return connection ? `${connection.first_name} ${connection.last_name}` : undefined;
  }, [isGeneratingMessages, currentConnectionIndex, selectedConnections, connections]);

  return {
    isGeneratingMessages,
    workflowState,
    messageModalOpen,
    selectedConnectionForMessages,
    messageHistory,
    generatedMessages,
    currentConnectionName,
    progressTracker,
    handleMessageClick,
    handleCloseMessageModal,
    handleSendMessage,
    handleGenerateMessages,
    handleStopGeneration,
    handleApproveAndNext,
    handleSkipConnection,
  };
}
