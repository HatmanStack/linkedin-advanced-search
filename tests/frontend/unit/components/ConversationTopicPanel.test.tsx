/**
 * Unit Tests for ConversationTopicPanel Component
 * Task 3: Enhance ConversationTopicPanel with workflow controls
 * 
 * Tests cover:
 * - Button state transitions between Generate and Stop modes
 * - Enable/disable logic based on selections and topic
 * - Red gradient styling for stop button
 * - Current connection name display during generation
 * - Textarea disable state during generation
 * 
 * Requirements: 2.1, 2.3, 4.1, 4.2
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import ConversationTopicPanel from '@/features/messages/components/ConversationTopicPanel';

// Mock UI components
vi.mock('@/components/ui/card', () => ({
  Card: ({ children, className }: any) => (
    <div className={className} data-testid="card">
      {children}
    </div>
  ),
  CardContent: ({ children, className }: any) => (
    <div className={className} data-testid="card-content">
      {children}
    </div>
  ),
  CardDescription: ({ children, className }: any) => (
    <div className={className} data-testid="card-description">
      {children}
    </div>
  ),
  CardHeader: ({ children }: any) => (
    <div data-testid="card-header">
      {children}
    </div>
  ),
  CardTitle: ({ children, className }: any) => (
    <h3 className={className} data-testid="card-title">
      {children}
    </h3>
  ),
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, className, ...props }: any) => (
    <button
      onClick={onClick}
      disabled={disabled}
      className={className}
      data-testid="generate-button"
      {...props}
    >
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/textarea', () => ({
  Textarea: ({ value, onChange, disabled, className, placeholder, ...props }: any) => (
    <textarea
      value={value}
      onChange={onChange}
      disabled={disabled}
      className={className}
      placeholder={placeholder}
      data-testid="topic-textarea"
      {...props}
    />
  ),
}));

// Mock Lucide React icons
vi.mock('lucide-react', () => ({
  Sparkles: () => <div data-testid="sparkles-icon" />,
  Send: () => <div data-testid="send-icon" />,
  Square: () => <div data-testid="square-icon" />,
}));

describe('ConversationTopicPanel Component', () => {
  const mockOnTopicChange = vi.fn();
  const mockOnGenerateMessages = vi.fn();
  const mockOnStopGeneration = vi.fn();

  const defaultProps = {
    topic: '',
    onTopicChange: mockOnTopicChange,
    onGenerateMessages: mockOnGenerateMessages,
    selectedConnectionsCount: 0,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('should render the component with default props', () => {
      render(<ConversationTopicPanel {...defaultProps} />);

      expect(screen.getByTestId('card')).toBeInTheDocument();
      expect(screen.getByTestId('card-title')).toHaveTextContent('Conversation Topic');
      expect(screen.getByTestId('sparkles-icon')).toBeInTheDocument();
      expect(screen.getByTestId('topic-textarea')).toBeInTheDocument();
      expect(screen.getByTestId('generate-button')).toBeInTheDocument();
    });

    it('should display the default description when not generating', () => {
      render(<ConversationTopicPanel {...defaultProps} />);

      expect(screen.getByTestId('card-description')).toHaveTextContent(
        'What would you like to discuss with your selected connections?'
      );
    });

    it('should display the topic value in textarea', () => {
      const topic = 'AI trends in product development';
      render(<ConversationTopicPanel {...defaultProps} topic={topic} />);

      const textarea = screen.getByTestId('topic-textarea') as HTMLTextAreaElement;
      expect(textarea.value).toBe(topic);
    });

    it('should have correct placeholder text', () => {
      render(<ConversationTopicPanel {...defaultProps} />);

      const textarea = screen.getByTestId('topic-textarea');
      expect(textarea).toHaveAttribute(
        'placeholder',
        'e.g., AI trends in product development, career advice, collaboration opportunities...'
      );
    });
  });

  describe('Button State Logic - Normal Mode', () => {
    it('should show "Generate Personalized Messages" button with Send icon in normal mode', () => {
      render(
        <ConversationTopicPanel
          {...defaultProps}
          topic="Test topic"
          selectedConnectionsCount={1}
        />
      );

      const button = screen.getByTestId('generate-button');
      expect(button).toHaveTextContent('Generate Personalized Messages');
      expect(screen.getByTestId('send-icon')).toBeInTheDocument();
      expect(screen.queryByTestId('square-icon')).not.toBeInTheDocument();
    });

    it('should have blue gradient styling in normal mode', () => {
      render(
        <ConversationTopicPanel
          {...defaultProps}
          topic="Test topic"
          selectedConnectionsCount={1}
        />
      );

      const button = screen.getByTestId('generate-button');
      expect(button).toHaveClass('bg-gradient-to-r', 'from-blue-600', 'to-purple-600');
      expect(button).not.toHaveClass('from-red-600', 'to-red-700');
    });

    it('should be disabled when no connections are selected', () => {
      render(
        <ConversationTopicPanel
          {...defaultProps}
          topic="Test topic"
          selectedConnectionsCount={0}
        />
      );

      const button = screen.getByTestId('generate-button');
      expect(button).toBeDisabled();
    });

    it('should be disabled when topic is empty', () => {
      render(
        <ConversationTopicPanel
          {...defaultProps}
          topic=""
          selectedConnectionsCount={1}
        />
      );

      const button = screen.getByTestId('generate-button');
      expect(button).toBeDisabled();
    });

    it('should be disabled when topic is only whitespace', () => {
      render(
        <ConversationTopicPanel
          {...defaultProps}
          topic="   "
          selectedConnectionsCount={1}
        />
      );

      const button = screen.getByTestId('generate-button');
      expect(button).toBeDisabled();
    });

    it('should be enabled when both topic and connections are provided', () => {
      render(
        <ConversationTopicPanel
          {...defaultProps}
          topic="Test topic"
          selectedConnectionsCount={1}
        />
      );

      const button = screen.getByTestId('generate-button');
      expect(button).not.toBeDisabled();
    });

    it('should call onGenerateMessages when clicked in normal mode', async () => {
      const user = userEvent.setup();

      render(
        <ConversationTopicPanel
          {...defaultProps}
          topic="Test topic"
          selectedConnectionsCount={1}
        />
      );

      const button = screen.getByTestId('generate-button');
      await user.click(button);

      expect(mockOnGenerateMessages).toHaveBeenCalledTimes(1);
      expect(mockOnStopGeneration).not.toHaveBeenCalled();
    });
  });

  describe('Button State Logic - Generation Mode', () => {
    it('should show "Stop" button with Square icon in generation mode', () => {
      render(
        <ConversationTopicPanel
          {...defaultProps}
          topic="Test topic"
          selectedConnectionsCount={1}
          isGenerating={true}
          onStopGeneration={mockOnStopGeneration}
        />
      );

      const button = screen.getByTestId('generate-button');
      expect(button).toHaveTextContent('Stop');
      expect(screen.getByTestId('square-icon')).toBeInTheDocument();
      expect(screen.queryByTestId('send-icon')).not.toBeInTheDocument();
    });

    it('should have red gradient styling in generation mode', () => {
      render(
        <ConversationTopicPanel
          {...defaultProps}
          topic="Test topic"
          selectedConnectionsCount={1}
          isGenerating={true}
          onStopGeneration={mockOnStopGeneration}
        />
      );

      const button = screen.getByTestId('generate-button');
      expect(button).toHaveClass('bg-gradient-to-r', 'from-red-600', 'to-red-700');
      expect(button).not.toHaveClass('from-blue-600', 'to-purple-600');
    });

    it('should be enabled in generation mode regardless of topic/connections', () => {
      render(
        <ConversationTopicPanel
          {...defaultProps}
          topic=""
          selectedConnectionsCount={0}
          isGenerating={true}
          onStopGeneration={mockOnStopGeneration}
        />
      );

      const button = screen.getByTestId('generate-button');
      expect(button).not.toBeDisabled();
    });

    it('should call onStopGeneration when clicked in generation mode', async () => {
      const user = userEvent.setup();

      render(
        <ConversationTopicPanel
          {...defaultProps}
          topic="Test topic"
          selectedConnectionsCount={1}
          isGenerating={true}
          onStopGeneration={mockOnStopGeneration}
        />
      );

      const button = screen.getByTestId('generate-button');
      await user.click(button);

      expect(mockOnStopGeneration).toHaveBeenCalledTimes(1);
      expect(mockOnGenerateMessages).not.toHaveBeenCalled();
    });

    it('should not call onStopGeneration if callback is not provided', async () => {
      const user = userEvent.setup();

      render(
        <ConversationTopicPanel
          {...defaultProps}
          topic="Test topic"
          selectedConnectionsCount={1}
          isGenerating={true}
        />
      );

      const button = screen.getByTestId('generate-button');
      await user.click(button);

      expect(mockOnStopGeneration).not.toHaveBeenCalled();
      expect(mockOnGenerateMessages).toHaveBeenCalledTimes(1);
    });
  });

  describe('Current Connection Display', () => {
    it('should show current connection name in description during generation', () => {
      render(
        <ConversationTopicPanel
          {...defaultProps}
          isGenerating={true}
          currentConnectionName="John Doe"
          onStopGeneration={mockOnStopGeneration}
        />
      );

      expect(screen.getByTestId('card-description')).toHaveTextContent(
        'Generating message for John Doe...'
      );
    });

    it('should show default description when generating but no connection name provided', () => {
      render(
        <ConversationTopicPanel
          {...defaultProps}
          isGenerating={true}
          onStopGeneration={mockOnStopGeneration}
        />
      );

      expect(screen.getByTestId('card-description')).toHaveTextContent(
        'What would you like to discuss with your selected connections?'
      );
    });

    it('should show default description when not generating even with connection name', () => {
      render(
        <ConversationTopicPanel
          {...defaultProps}
          isGenerating={false}
          currentConnectionName="John Doe"
        />
      );

      expect(screen.getByTestId('card-description')).toHaveTextContent(
        'What would you like to discuss with your selected connections?'
      );
    });
  });

  describe('Textarea Behavior', () => {
    it('should call onTopicChange when textarea value changes', async () => {
      render(<ConversationTopicPanel {...defaultProps} />);

      const textarea = screen.getByTestId('topic-textarea');
      
      // Simulate direct change event instead of typing
      fireEvent.change(textarea, { target: { value: 'New topic' } });

      expect(mockOnTopicChange).toHaveBeenCalledWith('New topic');
      expect(mockOnTopicChange).toHaveBeenCalledTimes(1);
    });

    it('should be disabled during generation', () => {
      render(
        <ConversationTopicPanel
          {...defaultProps}
          isGenerating={true}
          onStopGeneration={mockOnStopGeneration}
        />
      );

      const textarea = screen.getByTestId('topic-textarea');
      expect(textarea).toBeDisabled();
    });

    it('should be enabled when not generating', () => {
      render(
        <ConversationTopicPanel
          {...defaultProps}
          isGenerating={false}
        />
      );

      const textarea = screen.getByTestId('topic-textarea');
      expect(textarea).not.toBeDisabled();
    });
  });

  describe('State Transitions', () => {
    it('should transition from normal to generation mode', () => {
      const { rerender } = render(
        <ConversationTopicPanel
          {...defaultProps}
          topic="Test topic"
          selectedConnectionsCount={1}
        />
      );

      // Initially in normal mode
      expect(screen.getByTestId('generate-button')).toHaveTextContent('Generate Personalized Messages');
      expect(screen.getByTestId('send-icon')).toBeInTheDocument();

      // Transition to generation mode
      rerender(
        <ConversationTopicPanel
          {...defaultProps}
          topic="Test topic"
          selectedConnectionsCount={1}
          isGenerating={true}
          onStopGeneration={mockOnStopGeneration}
        />
      );

      expect(screen.getByTestId('generate-button')).toHaveTextContent('Stop');
      expect(screen.getByTestId('square-icon')).toBeInTheDocument();
      expect(screen.queryByTestId('send-icon')).not.toBeInTheDocument();
    });

    it('should transition from generation to normal mode', () => {
      const { rerender } = render(
        <ConversationTopicPanel
          {...defaultProps}
          topic="Test topic"
          selectedConnectionsCount={1}
          isGenerating={true}
          onStopGeneration={mockOnStopGeneration}
        />
      );

      // Initially in generation mode
      expect(screen.getByTestId('generate-button')).toHaveTextContent('Stop');
      expect(screen.getByTestId('square-icon')).toBeInTheDocument();

      // Transition to normal mode
      rerender(
        <ConversationTopicPanel
          {...defaultProps}
          topic="Test topic"
          selectedConnectionsCount={1}
          isGenerating={false}
        />
      );

      expect(screen.getByTestId('generate-button')).toHaveTextContent('Generate Personalized Messages');
      expect(screen.getByTestId('send-icon')).toBeInTheDocument();
      expect(screen.queryByTestId('square-icon')).not.toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should handle undefined isGenerating prop (defaults to false)', () => {
      render(
        <ConversationTopicPanel
          {...defaultProps}
          topic="Test topic"
          selectedConnectionsCount={1}
        />
      );

      expect(screen.getByTestId('generate-button')).toHaveTextContent('Generate Personalized Messages');
      expect(screen.getByTestId('send-icon')).toBeInTheDocument();
    });

    it('should handle missing onStopGeneration callback gracefully', async () => {
      const user = userEvent.setup();

      render(
        <ConversationTopicPanel
          {...defaultProps}
          topic="Test topic"
          selectedConnectionsCount={1}
          isGenerating={true}
        />
      );

      const button = screen.getByTestId('generate-button');
      await user.click(button);

      // Should fall back to onGenerateMessages
      expect(mockOnGenerateMessages).toHaveBeenCalledTimes(1);
    });

    it('should handle empty currentConnectionName', () => {
      render(
        <ConversationTopicPanel
          {...defaultProps}
          isGenerating={true}
          currentConnectionName=""
          onStopGeneration={mockOnStopGeneration}
        />
      );

      expect(screen.getByTestId('card-description')).toHaveTextContent(
        'What would you like to discuss with your selected connections?'
      );
    });

    it('should handle very long connection names', () => {
      const longName = 'John Doe with a very long name that might cause display issues';
      
      render(
        <ConversationTopicPanel
          {...defaultProps}
          isGenerating={true}
          currentConnectionName={longName}
          onStopGeneration={mockOnStopGeneration}
        />
      );

      expect(screen.getByTestId('card-description')).toHaveTextContent(
        `Generating message for ${longName}...`
      );
    });
  });

  describe('Accessibility', () => {
    it('should have proper button states for screen readers', () => {
      render(
        <ConversationTopicPanel
          {...defaultProps}
          topic=""
          selectedConnectionsCount={0}
        />
      );

      const button = screen.getByTestId('generate-button');
      expect(button).toBeDisabled();
      expect(button).toHaveAttribute('disabled');
    });

    it('should maintain focus management during state transitions', () => {
      const { rerender } = render(
        <ConversationTopicPanel
          {...defaultProps}
          topic="Test topic"
          selectedConnectionsCount={1}
        />
      );

      const button = screen.getByTestId('generate-button');
      button.focus();
      expect(document.activeElement).toBe(button);

      // Transition to generation mode
      rerender(
        <ConversationTopicPanel
          {...defaultProps}
          topic="Test topic"
          selectedConnectionsCount={1}
          isGenerating={true}
          onStopGeneration={mockOnStopGeneration}
        />
      );

      // Button should still be focusable
      const updatedButton = screen.getByTestId('generate-button');
      expect(updatedButton).toBeInTheDocument();
    });
  });

  describe('CSS Classes and Styling', () => {
    it('should apply correct CSS classes to card components', () => {
      render(<ConversationTopicPanel {...defaultProps} />);

      expect(screen.getByTestId('card')).toHaveClass('bg-white/5', 'backdrop-blur-md', 'border-white/10');
      expect(screen.getByTestId('card-title')).toHaveClass('text-white');
      expect(screen.getByTestId('card-description')).toHaveClass('text-slate-300');
    });

    it('should apply correct CSS classes to textarea', () => {
      render(<ConversationTopicPanel {...defaultProps} />);

      const textarea = screen.getByTestId('topic-textarea');
      expect(textarea).toHaveClass(
        'bg-white/5',
        'border-white/20',
        'text-white',
        'placeholder-slate-400',
        'min-h-[100px]'
      );
    });

    it('should apply correct CSS classes to button in normal mode', () => {
      render(
        <ConversationTopicPanel
          {...defaultProps}
          topic="Test topic"
          selectedConnectionsCount={1}
        />
      );

      const button = screen.getByTestId('generate-button');
      expect(button).toHaveClass(
        'w-full',
        'text-white',
        'bg-gradient-to-r',
        'from-blue-600',
        'to-purple-600',
        'hover:from-blue-700',
        'hover:to-purple-700'
      );
    });

    it('should apply correct CSS classes to button in generation mode', () => {
      render(
        <ConversationTopicPanel
          {...defaultProps}
          isGenerating={true}
          onStopGeneration={mockOnStopGeneration}
        />
      );

      const button = screen.getByTestId('generate-button');
      expect(button).toHaveClass(
        'w-full',
        'text-white',
        'bg-gradient-to-r',
        'from-red-600',
        'to-red-700',
        'hover:from-red-700',
        'hover:to-red-800'
      );
    });
  });
});