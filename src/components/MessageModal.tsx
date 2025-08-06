import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Send, MessageSquare, Loader2, AlertCircle } from 'lucide-react';
import { ApiError } from '@/services/dbConnector';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { transformErrorForUser, getToastVariant, ERROR_MESSAGES } from '@/utils/errorHandling';
import { NoMessagesState } from '@/components/ui/empty-state';
import LoadingOverlay from '@/components/ui/loading-overlay';
import type { Connection, Message, MessageModalProps } from '@/types';

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
  onRetryLoadMessages
}) => {
  const [messageInput, setMessageInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  /**
   * Formats a timestamp string for display in the message history
   * 
   * @param timestamp - ISO timestamp string to format
   * @returns Formatted timestamp string for display
   */
  const formatTimestamp = (timestamp: string): string => {
    try {
      const date = new Date(timestamp);
      return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch (error) {
      return 'Unknown time';
    }
  };

  // Scroll to bottom when messages change
  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollElement = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollElement) {
        scrollElement.scrollTop = scrollElement.scrollHeight;
      }
    }
  }, [connection.message_history]);

  // Handle escape key press
  useEffect(() => {
    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscapeKey);
    }

    return () => {
      document.removeEventListener('keydown', handleEscapeKey);
    };
  }, [isOpen, onClose]);

  /**
   * Handles sending a new message with validation, error handling, and user feedback
   * Validates message length, calls the onSendMessage callback, and shows appropriate toasts
   */
  const handleSendMessage = async () => {
    const trimmedMessage = messageInput.trim();

    // Validate message input
    if (!trimmedMessage) {
      toast({
        title: "Empty Message",
        description: "Please enter a message before sending.",
        variant: "default",
      });
      return;
    }

    if (trimmedMessage.length > 1000) {
      toast({
        title: "Message Too Long",
        description: "Messages must be 1000 characters or less. Please shorten your message.",
        variant: "destructive",
      });
      return;
    }

    if (!onSendMessage) {
      toast({
        title: "Feature Not Available",
        description: "Message sending functionality will be available in a future update.",
        variant: "default",
      });
      return;
    }

    setIsSending(true);
    try {
      await onSendMessage(trimmedMessage);
      setMessageInput(''); // Clear input on success

      toast({
        title: "Message Sent",
        description: "Your message has been sent successfully.",
        variant: "default",
      });
    } catch (error) {
      console.error('Error sending message:', error);

      // Transform error for user-friendly display
      const errorInfo = transformErrorForUser(
        error,
        ERROR_MESSAGES.SEND_MESSAGE,
        [
          {
            label: 'Try Again',
            action: () => handleSendMessage(),
            primary: true
          }
        ]
      );

      toast({
        title: "Send Failed",
        description: errorInfo.userMessage,
        variant: getToastVariant(errorInfo.severity),
      });
    } finally {
      setIsSending(false);
    }
  };

  /**
   * Handles keyboard events in the message input field
   * Sends message on Enter key press (without Shift modifier)
   * 
   * @param event - The keyboard event
   */
  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSendMessage();
    }
  };

  const messages = connection.message_history || [];
  const connectionName = `${connection.first_name} ${connection.last_name}`.trim() || 'Unknown Contact';

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Messages with {connectionName}
          </DialogTitle>
          <DialogDescription>
            {connection.position && connection.company
              ? `${connection.position} at ${connection.company}`
              : connection.position || connection.company || 'LinkedIn Connection'
            }
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
                <NoMessagesState
                  connectionName={connection.first_name}
                  className="h-full"
                />
              ) : (
                <div className="space-y-4">
                  {messages.map((message, index) => (
                    <div
                      key={message.id || `msg-${index}`}
                      className={cn(
                        "flex flex-col max-w-[80%]",
                        message.sender === 'user'
                          ? "ml-auto items-end"
                          : "mr-auto items-start"
                      )}
                    >
                      <div
                        className={cn(
                          "rounded-lg px-4 py-2 text-sm",
                          message.sender === 'user'
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground"
                        )}
                      >
                        <p className="whitespace-pre-wrap break-words">
                          {message.content}
                        </p>
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
          <div className="flex w-full gap-2">
            <Input
              placeholder="Type your message..."
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isSending}
              className="flex-1"
              maxLength={1000}
            />
            <Button
              onClick={handleSendMessage}
              disabled={isSending || !messageInput.trim()}
              size="icon"
              className="shrink-0"
            >
              {isSending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
          <div className="flex justify-between w-full text-xs text-muted-foreground">
            <span>Press Enter to send, Shift+Enter for new line</span>
            <span>{messageInput.length}/1000</span>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default MessageModal;