import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { ScrollArea } from '@/shared/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import {
  Send,
  MessageSquare,
  Loader2,
  AlertCircle,
  Sparkles,
  Check,
  SkipForward,
} from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { useToast } from '@/shared/hooks';
import { createLogger } from '@/shared/utils/logger';

const logger = createLogger('MessageModal');
import {
  transformErrorForUser,
  getToastVariant,
  ERROR_MESSAGES,
} from '@/shared/utils/errorHandling';
import { NoMessagesState } from '@/shared/components/ui/empty-state';
import LoadingOverlay from '@/shared/components/ui/loading-overlay';
import type { MessageModalProps } from '@/types';

/**
 * MessageModal Component
 *
 * Modal component for displaying and managing message history with connections.
 * Provides scrollable message display, message input functionality, and error handling.
 *
 * @param props - The component props
 * @param props.isOpen - Whether the modal is open
 * @param props.connection - Connection whose messages to display
 * @param props.onClose - Callback to close the modal
 * @param props.onSendMessage - Callback to send a new message (optional)
 * @param props.isLoadingMessages - Whether messages are currently loading
 * @param props.messagesError - Error message if message loading failed
 * @param props.onRetryLoadMessages - Callback to retry loading messages
 * @param props.className - Additional CSS classes
 *
 * @returns JSX element representing the message modal
 */
export const MessageModal: React.FC<MessageModalProps> = ({
  isOpen,
  connection,
  onClose,
  onSendMessage,
  isLoadingMessages = false,
  messagesError = null,
  onRetryLoadMessages,
  prePopulatedMessage,
  isGeneratedContent = false,
  showGenerationControls = false,
  onApproveAndNext,
  onSkipConnection,
}) => {
  const [messageInput, setMessageInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Handle pre-populated message content
  useEffect(() => {
    if (prePopulatedMessage && isOpen) {
      setMessageInput(prePopulatedMessage);
    } else if (!prePopulatedMessage && isOpen) {
      setMessageInput('');
    }
  }, [prePopulatedMessage, isOpen]);

  /**
   * Formats a timestamp string for display in the message history
   *
   * @param timestamp - ISO timestamp string to format
   * @returns Formatted timestamp string for display
   */
  const formatTimestamp = (timestamp: string): string => {
    try {
      const date = new Date(timestamp);
      // Check if the date is valid
      if (isNaN(date.getTime())) {
        return 'Unknown time';
      }
      return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return 'Unknown time';
    }
  };

  // Scroll to bottom when messages change
  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollElement = scrollAreaRef.current.querySelector(
        '[data-radix-scroll-area-viewport]'
      );
      if (scrollElement) {
        scrollElement.scrollTop = scrollElement.scrollHeight;
      }
    }
  }, [connection.message_history]);

  // Handle generation workflow shortcuts (Escape is handled by Dialog's onOpenChange)
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isOpen) return;

      // Generation workflow keyboard shortcuts
      if (showGenerationControls) {
        if (event.key === 'Enter' && !event.shiftKey && event.ctrlKey) {
          // Ctrl+Enter to approve and next
          event.preventDefault();
          if (onApproveAndNext) {
            onApproveAndNext();
          }
        } else if (event.key === 's' && event.ctrlKey) {
          // Ctrl+S to skip
          event.preventDefault();
          if (onSkipConnection) {
            onSkipConnection();
          }
        }
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, showGenerationControls, onApproveAndNext, onSkipConnection]);

  /**
   * Handles sending a new message with validation, error handling, and user feedback
   * Validates message length, calls the onSendMessage callback, and shows appropriate toasts
   */
  const handleSendMessage = async () => {
    const trimmedMessage = messageInput.trim();

    // Validate message input
    if (!trimmedMessage) {
      toast({
        title: 'Empty Message',
        description: 'Please enter a message before sending.',
        variant: 'default',
      });
      return;
    }

    if (trimmedMessage.length > 1000) {
      toast({
        title: 'Message Too Long',
        description: 'Messages must be 1000 characters or less. Please shorten your message.',
        variant: 'destructive',
      });
      return;
    }

    if (!onSendMessage) {
      toast({
        title: 'Feature Not Available',
        description: 'Message sending functionality will be available in a future update.',
        variant: 'default',
      });
      return;
    }

    setIsSending(true);
    try {
      await onSendMessage(trimmedMessage);
      setMessageInput(''); // Clear input on success

      toast({
        title: 'Message Sent',
        description: 'Your message has been sent successfully.',
        variant: 'default',
      });
    } catch (error) {
      logger.error('Error sending message', { error });

      // Transform error for user-friendly display
      const errorInfo = transformErrorForUser(error, ERROR_MESSAGES.SEND_MESSAGE, [
        {
          label: 'Try Again',
          action: () => handleSendMessage(),
          primary: true,
        },
      ]);

      toast({
        title: 'Send Failed',
        description: errorInfo.userMessage,
        variant: getToastVariant(errorInfo.severity),
      });
    } finally {
      setIsSending(false);
    }
  };

  /**
   * Handles keyboard events in the message input field
   * Sends message on Enter key press (without Shift modifier) for normal mode
   * In generation mode, Enter approves and moves to next connection
   *
   * @param event - The keyboard event
   */
  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();

      if (showGenerationControls && onApproveAndNext) {
        onApproveAndNext();
      } else {
        handleSendMessage();
      }
    }
  };

  const messages = connection.message_history || [];
  const connectionName =
    `${connection.first_name} ${connection.last_name}`.trim() || 'Unknown Contact';

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          if (showGenerationControls && onSkipConnection) {
            onSkipConnection();
          } else {
            onClose();
          }
        }
      }}
    >
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Messages with {connectionName}
            {isGeneratedContent && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                <Sparkles className="h-3 w-3 mr-1" />
                AI Generated
              </span>
            )}
          </DialogTitle>
          <DialogDescription>
            {connection.position && connection.company
              ? `${connection.position} at ${connection.company}`
              : connection.position || connection.company || 'LinkedIn Connection'}
            {isGeneratedContent && (
              <div className="mt-2 text-sm text-blue-600 dark:text-blue-400">
                This message was generated by AI based on your conversation topic. You can edit it
                before sending.
              </div>
            )}
          </DialogDescription>
        </DialogHeader>

        {/* Message History */}
        <div className="flex-1 min-h-0">
          <LoadingOverlay
            isLoading={isLoadingMessages}
            message="Loading message history..."
            className="h-[400px] w-full border rounded-md"
          >
            <ScrollArea ref={scrollAreaRef} className="h-[400px] w-full border rounded-md p-4">
              {messagesError ? (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <AlertCircle className="h-12 w-12 mb-4 text-red-400 opacity-50" />
                  <p className="text-lg font-medium mb-2 text-red-300">Failed to Load Messages</p>
                  <p className="text-sm text-red-400 mb-4">{messagesError}</p>
                  {onRetryLoadMessages && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={onRetryLoadMessages}
                      className="border-red-500/30 text-red-300 hover:bg-red-500/10"
                    >
                      Try Again
                    </Button>
                  )}
                </div>
              ) : messages.length === 0 ? (
                <NoMessagesState connectionName={connection.first_name} className="h-full" />
              ) : (
                <div className="space-y-4">
                  {messages.map((message, index) => (
                    <div
                      key={message.id || `msg-${index}`}
                      className={cn(
                        'flex flex-col max-w-[80%]',
                        message.sender === 'user' ? 'ml-auto items-end' : 'mr-auto items-start'
                      )}
                    >
                      <div
                        className={cn(
                          'rounded-lg px-4 py-2 text-sm',
                          message.sender === 'user'
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted text-muted-foreground'
                        )}
                      >
                        <p className="whitespace-pre-wrap break-words">{message.content}</p>
                      </div>
                      <span className="text-xs text-muted-foreground mt-1">
                        {formatTimestamp(message.timestamp)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </LoadingOverlay>
        </div>

        {/* Message Input */}
        <DialogFooter className="flex-col space-y-2 sm:flex-row sm:space-y-0">
          {isGeneratedContent && (
            <div className="w-full mb-2 p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-md">
              <div className="flex items-center gap-2 text-sm text-blue-700 dark:text-blue-300">
                <Sparkles className="h-4 w-4" />
                <span className="font-medium">AI-Generated Message</span>
              </div>
              <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                This message was created based on your conversation topic and connection profile.
                Feel free to edit it before sending.
              </p>
            </div>
          )}

          <div className="flex w-full gap-2">
            <Input
              placeholder={
                isGeneratedContent ? 'Edit the AI-generated message...' : 'Type your message...'
              }
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isSending}
              className={cn(
                'flex-1',
                isGeneratedContent &&
                  'border-blue-300 dark:border-blue-700 bg-blue-50/50 dark:bg-blue-950/20'
              )}
              maxLength={1000}
            />

            {showGenerationControls ? (
              <div className="flex gap-2">
                <Button
                  onClick={() => {
                    if (onSkipConnection) {
                      onSkipConnection();
                    }
                  }}
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                  disabled={isSending}
                >
                  <SkipForward className="h-4 w-4 mr-1" />
                  Skip
                </Button>
                <Button
                  onClick={() => {
                    if (onApproveAndNext) {
                      onApproveAndNext();
                    }
                  }}
                  size="sm"
                  className="shrink-0 bg-green-600 hover:bg-green-700"
                  disabled={isSending}
                >
                  <Check className="h-4 w-4 mr-1" />
                  Approve & Next
                </Button>
              </div>
            ) : (
              <Button
                onClick={handleSendMessage}
                disabled={isSending || !messageInput.trim()}
                size="icon"
                className="shrink-0"
                aria-label="Send message"
              >
                {isSending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            )}
          </div>

          <div className="flex justify-between w-full text-xs text-muted-foreground">
            <span>
              {showGenerationControls
                ? 'Enter to approve, Ctrl+S to skip, Esc to skip'
                : 'Press Enter to send, Shift+Enter for new line'}
            </span>
            <span>{messageInput.length}/1000</span>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default MessageModal;
