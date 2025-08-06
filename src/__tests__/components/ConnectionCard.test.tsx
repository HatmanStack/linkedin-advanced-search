/**
 * Comprehensive Unit Tests for ConnectionCard Component
 * Task 11.2: Test React components with mock data and user interactions
 * 
 * Tests cover:
 * - Enhanced ConnectionCard with new features and backward compatibility
 * - Connection status display and message click functionality
 * - Tag interactions and selection states
 * - Various connection types and edge cases
 * 
 * Requirements: 2.1, 2.5, 3.2, 4.1, 4.4
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import ConnectionCard from '@/components/ConnectionCard';
import type { Connection } from '@/types';

// Mock UI components
vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children, variant, className, onClick }: any) => (
    <span
      className={className}
      data-testid="badge"
      data-variant={variant}
      onClick={onClick}
    >
      {children}
    </span>
  ),
}));

vi.mock('@/components/ui/checkbox', () => ({
  Checkbox: ({ checked, onCheckedChange, disabled, className, ...props }: any) => (
    <input
      type="checkbox"
      checked={checked}
      onChange={(e) => onCheckedChange?.(e.target.checked)}
      disabled={disabled}
      className={className}
      data-testid="connection-checkbox"
      {...props}
    />
  ),
}));

// Mock Lucide React icons
vi.mock('lucide-react', () => ({
  MessageSquare: () => <div data-testid="message-square-icon" />,
  ExternalLink: () => <div data-testid="external-link-icon" />,
  User: () => <div data-testid="user-icon" />,
  Building: () => <div data-testid="building-icon" />,
  MapPin: () => <div data-testid="mappin-icon" />,
  Tag: () => <div data-testid="tag-icon" />,
}));

describe('ConnectionCard Component', () => {
  const mockConnection: Connection = {
    id: 'test-connection-1',
    first_name: 'John',
    last_name: 'Doe',
    position: 'Software Engineer',
    company: 'TechCorp',
    location: 'San Francisco, CA',
    headline: 'Building great software solutions',
    recent_activity: 'Posted about React development',
    common_interests: ['JavaScript', 'React', 'Node.js'],
    messages: 5,
    date_added: '2024-01-01T00:00:00Z',
    linkedin_url: 'https://linkedin.com/in/johndoe',
    tags: ['JavaScript', 'React'],
    last_action_summary: 'Sent connection request',
    status: 'allies',
    message_history: []
  };

  const mockOnSelect = vi.fn();
  const mockOnNewConnectionClick = vi.fn();
  const mockOnTagClick = vi.fn();
  const mockOnMessageClick = vi.fn();
  const mockOnCheckboxChange = vi.fn();

  // Mock window.open to prevent "Not implemented" errors in jsdom
  const mockWindowOpen = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, 'open', {
      value: mockWindowOpen,
      writable: true,
    });
  });

  describe('Basic Rendering', () => {
    it('should render connection information correctly', () => {
      render(
        <ConnectionCard
          connection={mockConnection}
          onSelect={mockOnSelect}
        />
      );

      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('Software Engineer')).toBeInTheDocument();
      expect(screen.getByText('TechCorp')).toBeInTheDocument();
      expect(screen.getByText('San Francisco, CA')).toBeInTheDocument();
      expect(screen.getByText('Sent connection request')).toBeInTheDocument();
    });

    it('should display profile initials', () => {
      render(
        <ConnectionCard
          connection={mockConnection}
          onSelect={mockOnSelect}
        />
      );

      expect(screen.getByText('JD')).toBeInTheDocument();
    });

    it('should show message count with icon', () => {
      render(
        <ConnectionCard
          connection={mockConnection}
          onSelect={mockOnSelect}
        />
      );

      expect(screen.getByTestId('message-square-icon')).toBeInTheDocument();
      expect(screen.getByText('5')).toBeInTheDocument();
    });

    it('should display tags as badges', () => {
      render(
        <ConnectionCard
          connection={mockConnection}
          onSelect={mockOnSelect}
          onTagClick={mockOnTagClick}
        />
      );

      expect(screen.getByText('JavaScript')).toBeInTheDocument();
      expect(screen.getByText('React')).toBeInTheDocument();
      expect(screen.getByTestId('tag-icon')).toBeInTheDocument();
    });

    it('should show date added', () => {
      render(
        <ConnectionCard
          connection={mockConnection}
          onSelect={mockOnSelect}
        />
      );

      expect(screen.getByText(/Added: 12\/31\/2023/)).toBeInTheDocument();
    });
  });

  describe('Connection Status Display', () => {
    it('should display "Connected" status for allies', () => {
      render(
        <ConnectionCard
          connection={{ ...mockConnection, status: 'allies' }}
          onSelect={mockOnSelect}
        />
      );

      expect(screen.getByText('Connected')).toBeInTheDocument();
    });

    it('should display "Pending" status for incoming', () => {
      render(
        <ConnectionCard
          connection={{ ...mockConnection, status: 'incoming' }}
          onSelect={mockOnSelect}
        />
      );

      expect(screen.getByText('Pending')).toBeInTheDocument();
    });

    it('should display "Sent" status for outgoing', () => {
      render(
        <ConnectionCard
          connection={{ ...mockConnection, status: 'outgoing' }}
          onSelect={mockOnSelect}
        />
      );

      expect(screen.getByText('Sent')).toBeInTheDocument();
    });

    it('should display "New Connection" status for possible', () => {
      render(
        <ConnectionCard
          connection={{ ...mockConnection, status: 'possible' }}
          onSelect={mockOnSelect}
        />
      );

      expect(screen.getByText('New Connection')).toBeInTheDocument();
    });

    it('should not display status badge when status is undefined', () => {
      const connectionWithoutStatus = { ...mockConnection };
      delete connectionWithoutStatus.status;

      render(
        <ConnectionCard
          connection={connectionWithoutStatus}
          onSelect={mockOnSelect}
        />
      );

      expect(screen.queryByText('Connected')).not.toBeInTheDocument();
      expect(screen.queryByText('Pending')).not.toBeInTheDocument();
      expect(screen.queryByText('Sent')).not.toBeInTheDocument();
      expect(screen.queryByText('New Connection')).not.toBeInTheDocument();
    });
  });

  describe('Selection States', () => {
    it('should show selected styling when isSelected is true', () => {
      render(
        <ConnectionCard
          connection={mockConnection}
          isSelected={true}
          onSelect={mockOnSelect}
        />
      );

      expect(screen.getByText('Selected')).toBeInTheDocument();
      
      // Find the main card container by looking for the element with the specific classes
      const cardContainer = screen.getByText('John Doe').closest('[class*="p-4 my-3 rounded-lg border"]');
      expect(cardContainer).toHaveClass('bg-blue-600/20', 'border-blue-500');
    });

    it('should show normal styling when isSelected is false', () => {
      render(
        <ConnectionCard
          connection={mockConnection}
          isSelected={false}
          onSelect={mockOnSelect}
        />
      );

      expect(screen.queryByText('Selected')).not.toBeInTheDocument();
      
      // Find the main card container by looking for the element with the specific classes
      const cardContainer = screen.getByText('John Doe').closest('[class*="p-4 my-3 rounded-lg border"]');
      expect(cardContainer).toHaveClass('bg-white/5', 'border-white/10');
    });
  });

  describe('New Connection Variant', () => {
    it('should show external link icon for new connections with LinkedIn URL', () => {
      render(
        <ConnectionCard
          connection={mockConnection}
          isNewConnection={true}
          onNewConnectionClick={mockOnNewConnectionClick}
        />
      );

      expect(screen.getByTestId('external-link-icon')).toBeInTheDocument();
    });

    it('should show warning for new connections without LinkedIn URL', () => {
      const connectionWithoutUrl = { ...mockConnection, linkedin_url: undefined };

      render(
        <ConnectionCard
          connection={connectionWithoutUrl}
          isNewConnection={true}
          onNewConnectionClick={mockOnNewConnectionClick}
        />
      );

      expect(screen.getByText('Click to search LinkedIn for this profile')).toBeInTheDocument();
    });

    it('should open LinkedIn URL when new connection card is clicked', async () => {
      const user = userEvent.setup();

      render(
        <ConnectionCard
          connection={mockConnection}
          isNewConnection={true}
          onNewConnectionClick={mockOnNewConnectionClick}
        />
      );

      const card = screen.getByText('John Doe').closest('div')?.parentElement?.parentElement;
      await user.click(card!);

      expect(mockWindowOpen).toHaveBeenCalledWith('https://linkedin.com/in/johndoe', '_blank', 'noopener,noreferrer');
    });
  });

  describe('Message Functionality', () => {
    it('should make message count clickable when onMessageClick is provided and messages > 0', () => {
      render(
        <ConnectionCard
          connection={mockConnection}
          onSelect={mockOnSelect}
          onMessageClick={mockOnMessageClick}
        />
      );

      const messageElement = screen.getByText('5').closest('div');
      expect(messageElement).toHaveClass('cursor-pointer');
    });

    it('should call onMessageClick when message count is clicked', async () => {
      const user = userEvent.setup();

      render(
        <ConnectionCard
          connection={mockConnection}
          onSelect={mockOnSelect}
          onMessageClick={mockOnMessageClick}
        />
      );

      const messageElement = screen.getByText('5').closest('div');
      await user.click(messageElement!);

      expect(mockOnMessageClick).toHaveBeenCalledWith(mockConnection);
    });

    it('should prevent event bubbling when message count is clicked', async () => {
      const user = userEvent.setup();

      render(
        <ConnectionCard
          connection={mockConnection}
          onSelect={mockOnSelect}
          onMessageClick={mockOnMessageClick}
        />
      );

      const messageElement = screen.getByText('5').closest('div');
      await user.click(messageElement!);

      expect(mockOnMessageClick).toHaveBeenCalledWith(mockConnection);
      expect(mockOnSelect).not.toHaveBeenCalled();
    });

    it('should show "No messages" when message count is 0', () => {
      const connectionWithoutMessages = { ...mockConnection, messages: 0 };

      render(
        <ConnectionCard
          connection={connectionWithoutMessages}
          onSelect={mockOnSelect}
          onMessageClick={mockOnMessageClick}
        />
      );

      expect(screen.getByText('No messages')).toBeInTheDocument();
    });

    it('should not make message count clickable when messages is 0', () => {
      const connectionWithoutMessages = { ...mockConnection, messages: 0 };

      render(
        <ConnectionCard
          connection={connectionWithoutMessages}
          onSelect={mockOnSelect}
          onMessageClick={mockOnMessageClick}
        />
      );

      const messageElement = screen.getByText('No messages').closest('div');
      expect(messageElement).not.toHaveClass('cursor-pointer');
    });

    it('should show tooltip for message count', () => {
      render(
        <ConnectionCard
          connection={mockConnection}
          onSelect={mockOnSelect}
          onMessageClick={mockOnMessageClick}
        />
      );

      const messageElement = screen.getByText('5').closest('div');
      expect(messageElement).toHaveAttribute('title', 'Click to view message history');
    });

    it('should show "No messages yet" tooltip when message count is 0', () => {
      const connectionWithoutMessages = { ...mockConnection, messages: 0 };

      render(
        <ConnectionCard
          connection={connectionWithoutMessages}
          onSelect={mockOnSelect}
          onMessageClick={mockOnMessageClick}
        />
      );

      const messageElement = screen.getByText('No messages').closest('div');
      expect(messageElement).toHaveAttribute('title', 'No messages yet');
    });
  });

  describe('Tag Interactions', () => {
    it('should call onTagClick when tag is clicked', async () => {
      const user = userEvent.setup();

      render(
        <ConnectionCard
          connection={mockConnection}
          onSelect={mockOnSelect}
          onTagClick={mockOnTagClick}
        />
      );

      const jsTag = screen.getByText('JavaScript');
      await user.click(jsTag);

      expect(mockOnTagClick).toHaveBeenCalledWith('JavaScript');
    });

    it('should prevent event bubbling when tag is clicked', async () => {
      const user = userEvent.setup();

      render(
        <ConnectionCard
          connection={mockConnection}
          onSelect={mockOnSelect}
          onTagClick={mockOnTagClick}
        />
      );

      const jsTag = screen.getByText('JavaScript');
      await user.click(jsTag);

      expect(mockOnTagClick).toHaveBeenCalledWith('JavaScript');
      expect(mockOnSelect).not.toHaveBeenCalled();
    });

    it('should highlight active tags', () => {
      render(
        <ConnectionCard
          connection={mockConnection}
          onSelect={mockOnSelect}
          onTagClick={mockOnTagClick}
          activeTags={['JavaScript']}
        />
      );

      const jsTag = screen.getByText('JavaScript');
      expect(jsTag).toHaveClass('bg-blue-600', 'text-white', 'border-blue-500');
    });

    it('should show normal styling for inactive tags', () => {
      render(
        <ConnectionCard
          connection={mockConnection}
          onSelect={mockOnSelect}
          onTagClick={mockOnTagClick}
          activeTags={['Python']}
        />
      );

      const jsTag = screen.getByText('JavaScript');
      expect(jsTag).toHaveClass('border-blue-400/30', 'text-blue-300');
    });

    it('should use common_interests when tags are not available', () => {
      const connectionWithInterests = {
        ...mockConnection,
        tags: undefined,
        common_interests: ['TypeScript', 'Vue.js']
      };

      render(
        <ConnectionCard
          connection={connectionWithInterests}
          onSelect={mockOnSelect}
          onTagClick={mockOnTagClick}
        />
      );

      expect(screen.getByText('TypeScript')).toBeInTheDocument();
      expect(screen.getByText('Vue.js')).toBeInTheDocument();
    });
  });

  describe('Card Click Behavior', () => {
    it('should open LinkedIn URL when regular card is clicked', async () => {
      const user = userEvent.setup();

      render(
        <ConnectionCard
          connection={mockConnection}
          onSelect={mockOnSelect}
        />
      );

      const card = screen.getByText('John Doe').closest('div')?.parentElement?.parentElement;
      await user.click(card!);

      expect(mockWindowOpen).toHaveBeenCalledWith('https://linkedin.com/in/johndoe', '_blank', 'noopener,noreferrer');
    });

    it('should call onNewConnectionClick when new connection card is clicked without LinkedIn URL', async () => {
      const user = userEvent.setup();
      const connectionWithoutUrl = { ...mockConnection, linkedin_url: undefined };

      render(
        <ConnectionCard
          connection={connectionWithoutUrl}
          isNewConnection={true}
          onNewConnectionClick={mockOnNewConnectionClick}
        />
      );

      const card = screen.getByText('John Doe').closest('div')?.parentElement?.parentElement;
      await user.click(card!);

      expect(mockOnNewConnectionClick).toHaveBeenCalledWith(connectionWithoutUrl);
    });

    it('should call onSelect when no LinkedIn URL and not new connection', async () => {
      const user = userEvent.setup();
      const connectionWithoutUrl = { ...mockConnection, linkedin_url: undefined };

      render(
        <ConnectionCard
          connection={connectionWithoutUrl}
          onSelect={mockOnSelect}
        />
      );

      const card = screen.getByText('John Doe').closest('div')?.parentElement?.parentElement;
      await user.click(card!);

      expect(mockOnSelect).toHaveBeenCalledWith('test-connection-1');
    });
  });

  describe('Demo Data Badge', () => {
    it('should show demo data badge when isFakeData is true', () => {
      const demoConnection = { ...mockConnection, isFakeData: true };

      render(
        <ConnectionCard
          connection={demoConnection}
          onSelect={mockOnSelect}
        />
      );

      expect(screen.getByText('Demo Data')).toBeInTheDocument();
    });

    it('should not show demo data badge when isFakeData is false', () => {
      const realConnection = { ...mockConnection, isFakeData: false };

      render(
        <ConnectionCard
          connection={realConnection}
          onSelect={mockOnSelect}
        />
      );

      expect(screen.queryByText('Demo Data')).not.toBeInTheDocument();
    });

    it('should not show demo data badge when isFakeData is undefined', () => {
      render(
        <ConnectionCard
          connection={mockConnection}
          onSelect={mockOnSelect}
        />
      );

      expect(screen.queryByText('Demo Data')).not.toBeInTheDocument();
    });
  });

  describe('Edge Cases and Missing Data', () => {
    it('should handle missing company gracefully', () => {
      const connectionWithoutCompany = { ...mockConnection, company: undefined };

      render(
        <ConnectionCard
          connection={connectionWithoutCompany}
          onSelect={mockOnSelect}
        />
      );

      expect(screen.getByText('Software Engineer')).toBeInTheDocument();
      expect(screen.queryByTestId('building-icon')).not.toBeInTheDocument();
    });

    it('should handle missing location gracefully', () => {
      const connectionWithoutLocation = { ...mockConnection, location: undefined };

      render(
        <ConnectionCard
          connection={connectionWithoutLocation}
          onSelect={mockOnSelect}
        />
      );

      expect(screen.queryByTestId('mappin-icon')).not.toBeInTheDocument();
      expect(screen.queryByText('San Francisco, CA')).not.toBeInTheDocument();
    });

    it('should handle missing tags and common_interests', () => {
      const connectionWithoutTags = {
        ...mockConnection,
        tags: undefined,
        common_interests: undefined
      };

      render(
        <ConnectionCard
          connection={connectionWithoutTags}
          onSelect={mockOnSelect}
        />
      );

      expect(screen.queryByTestId('tag-icon')).not.toBeInTheDocument();
    });

    it('should handle empty tags array', () => {
      const connectionWithEmptyTags = {
        ...mockConnection,
        tags: [],
        common_interests: []
      };

      render(
        <ConnectionCard
          connection={connectionWithEmptyTags}
          onSelect={mockOnSelect}
        />
      );

      expect(screen.queryByTestId('tag-icon')).not.toBeInTheDocument();
    });

    it('should handle missing recent activity', () => {
      const connectionWithoutActivity = {
        ...mockConnection,
        recent_activity: undefined,
        last_action_summary: undefined,
        last_activity_summary: undefined
      };

      render(
        <ConnectionCard
          connection={connectionWithoutActivity}
          onSelect={mockOnSelect}
        />
      );

      // Should still render other information
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    it('should handle missing date_added', () => {
      const connectionWithoutDate = { ...mockConnection, date_added: undefined };

      render(
        <ConnectionCard
          connection={connectionWithoutDate}
          onSelect={mockOnSelect}
        />
      );

      expect(screen.queryByText(/Added:/)).not.toBeInTheDocument();
    });

    it('should handle undefined messages count', () => {
      const connectionWithoutMessages = { ...mockConnection, messages: undefined };

      render(
        <ConnectionCard
          connection={connectionWithoutMessages}
          onSelect={mockOnSelect}
        />
      );

      expect(screen.queryByTestId('message-square-icon')).not.toBeInTheDocument();
    });
  });

  describe('Activity Summary Priority', () => {
    it('should prioritize last_action_summary over other activity fields', () => {
      const connectionWithMultipleActivities = {
        ...mockConnection,
        last_action_summary: 'Sent connection request',
        recent_activity: 'Posted about React',
        last_activity_summary: 'Liked a post'
      };

      render(
        <ConnectionCard
          connection={connectionWithMultipleActivities}
          onSelect={mockOnSelect}
        />
      );

      expect(screen.getByText('Sent connection request')).toBeInTheDocument();
      expect(screen.queryByText('Posted about React')).not.toBeInTheDocument();
      expect(screen.queryByText('Liked a post')).not.toBeInTheDocument();
    });

    it('should fall back to recent_activity when last_action_summary is missing', () => {
      const connectionWithRecentActivity = {
        ...mockConnection,
        last_action_summary: undefined,
        recent_activity: 'Posted about React',
        last_activity_summary: 'Liked a post'
      };

      render(
        <ConnectionCard
          connection={connectionWithRecentActivity}
          onSelect={mockOnSelect}
        />
      );

      expect(screen.getByText('Posted about React')).toBeInTheDocument();
      expect(screen.queryByText('Liked a post')).not.toBeInTheDocument();
    });

    it('should fall back to last_activity_summary when other activities are missing', () => {
      const connectionWithLastActivity = {
        ...mockConnection,
        last_action_summary: undefined,
        recent_activity: undefined,
        last_activity_summary: 'Liked a post'
      };

      render(
        <ConnectionCard
          connection={connectionWithLastActivity}
          onSelect={mockOnSelect}
        />
      );

      expect(screen.getByText('Liked a post')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper cursor styling for clickable elements', () => {
      render(
        <ConnectionCard
          connection={mockConnection}
          onSelect={mockOnSelect}
          onTagClick={mockOnTagClick}
          onMessageClick={mockOnMessageClick}
        />
      );

      // Find the main card container by looking for the element with the specific classes
      const cardContainer = screen.getByText('John Doe').closest('[class*="p-4 my-3 rounded-lg border"]');
      expect(cardContainer).toHaveClass('cursor-pointer');

      const tag = screen.getByText('JavaScript');
      expect(tag).toHaveClass('cursor-pointer');

      const messageElement = screen.getByText('5').closest('div');
      expect(messageElement).toHaveClass('cursor-pointer');
    });

    it('should provide meaningful tooltips', () => {
      render(
        <ConnectionCard
          connection={mockConnection}
          onSelect={mockOnSelect}
          onMessageClick={mockOnMessageClick}
        />
      );

      const messageElement = screen.getByText('5').closest('div');
      expect(messageElement).toHaveAttribute('title', 'Click to view message history');
    });
  });

  describe('Checkbox Functionality', () => {
    describe('Checkbox Visibility', () => {
      it('should show checkbox when showCheckbox is true and connection status is allies', () => {
        render(
          <ConnectionCard
            connection={{ ...mockConnection, status: 'allies' }}
            showCheckbox={true}
            isCheckboxEnabled={true}
            onCheckboxChange={mockOnCheckboxChange}
          />
        );

        expect(screen.getByTestId('connection-checkbox')).toBeInTheDocument();
      });

      it('should not show checkbox when showCheckbox is false', () => {
        render(
          <ConnectionCard
            connection={{ ...mockConnection, status: 'allies' }}
            showCheckbox={false}
            isCheckboxEnabled={true}
            onCheckboxChange={mockOnCheckboxChange}
          />
        );

        expect(screen.queryByTestId('connection-checkbox')).not.toBeInTheDocument();
      });

      it('should not show checkbox for non-allies connections even when showCheckbox is true', () => {
        const testStatuses = ['possible', 'incoming', 'outgoing', 'processed'] as const;
        
        testStatuses.forEach(status => {
          const { unmount } = render(
            <ConnectionCard
              connection={{ ...mockConnection, status }}
              showCheckbox={true}
              isCheckboxEnabled={true}
              onCheckboxChange={mockOnCheckboxChange}
            />
          );

          expect(screen.queryByTestId('connection-checkbox')).not.toBeInTheDocument();
          unmount();
        });
      });

      it('should not show checkbox when connection status is undefined', () => {
        const connectionWithoutStatus = { ...mockConnection };
        delete connectionWithoutStatus.status;

        render(
          <ConnectionCard
            connection={connectionWithoutStatus}
            showCheckbox={true}
            isCheckboxEnabled={true}
            onCheckboxChange={mockOnCheckboxChange}
          />
        );

        expect(screen.queryByTestId('connection-checkbox')).not.toBeInTheDocument();
      });
    });

    describe('Checkbox State Management', () => {
      it('should render checkbox as checked when isChecked is true', () => {
        render(
          <ConnectionCard
            connection={{ ...mockConnection, status: 'allies' }}
            showCheckbox={true}
            isCheckboxEnabled={true}
            isChecked={true}
            onCheckboxChange={mockOnCheckboxChange}
          />
        );

        const checkbox = screen.getByTestId('connection-checkbox') as HTMLInputElement;
        expect(checkbox.checked).toBe(true);
      });

      it('should render checkbox as unchecked when isChecked is false', () => {
        render(
          <ConnectionCard
            connection={{ ...mockConnection, status: 'allies' }}
            showCheckbox={true}
            isCheckboxEnabled={true}
            isChecked={false}
            onCheckboxChange={mockOnCheckboxChange}
          />
        );

        const checkbox = screen.getByTestId('connection-checkbox') as HTMLInputElement;
        expect(checkbox.checked).toBe(false);
      });

      it('should render checkbox as disabled when isCheckboxEnabled is false', () => {
        render(
          <ConnectionCard
            connection={{ ...mockConnection, status: 'allies' }}
            showCheckbox={true}
            isCheckboxEnabled={false}
            isChecked={false}
            onCheckboxChange={mockOnCheckboxChange}
          />
        );

        const checkbox = screen.getByTestId('connection-checkbox') as HTMLInputElement;
        expect(checkbox.disabled).toBe(true);
      });

      it('should render checkbox as enabled when isCheckboxEnabled is true', () => {
        render(
          <ConnectionCard
            connection={{ ...mockConnection, status: 'allies' }}
            showCheckbox={true}
            isCheckboxEnabled={true}
            isChecked={false}
            onCheckboxChange={mockOnCheckboxChange}
          />
        );

        const checkbox = screen.getByTestId('connection-checkbox') as HTMLInputElement;
        expect(checkbox.disabled).toBe(false);
      });
    });

    describe('Checkbox Interactions', () => {
      it('should call onCheckboxChange when checkbox is clicked', async () => {
        const user = userEvent.setup();

        render(
          <ConnectionCard
            connection={{ ...mockConnection, status: 'allies' }}
            showCheckbox={true}
            isCheckboxEnabled={true}
            isChecked={false}
            onCheckboxChange={mockOnCheckboxChange}
          />
        );

        const checkbox = screen.getByTestId('connection-checkbox');
        await user.click(checkbox);

        expect(mockOnCheckboxChange).toHaveBeenCalledWith('test-connection-1', true);
      });

      it('should call onCheckboxChange with false when unchecking', async () => {
        const user = userEvent.setup();

        render(
          <ConnectionCard
            connection={{ ...mockConnection, status: 'allies' }}
            showCheckbox={true}
            isCheckboxEnabled={true}
            isChecked={true}
            onCheckboxChange={mockOnCheckboxChange}
          />
        );

        const checkbox = screen.getByTestId('connection-checkbox');
        await user.click(checkbox);

        expect(mockOnCheckboxChange).toHaveBeenCalledWith('test-connection-1', false);
      });

      it('should prevent event bubbling when checkbox is clicked', async () => {
        const user = userEvent.setup();

        render(
          <ConnectionCard
            connection={{ ...mockConnection, status: 'allies' }}
            showCheckbox={true}
            isCheckboxEnabled={true}
            isChecked={false}
            onCheckboxChange={mockOnCheckboxChange}
            onSelect={mockOnSelect}
          />
        );

        const checkbox = screen.getByTestId('connection-checkbox');
        await user.click(checkbox);

        expect(mockOnCheckboxChange).toHaveBeenCalledWith('test-connection-1', true);
        expect(mockOnSelect).not.toHaveBeenCalled();
      });

      it('should not call onCheckboxChange when checkbox is disabled', async () => {
        const user = userEvent.setup();

        render(
          <ConnectionCard
            connection={{ ...mockConnection, status: 'allies' }}
            showCheckbox={true}
            isCheckboxEnabled={false}
            isChecked={false}
            onCheckboxChange={mockOnCheckboxChange}
          />
        );

        const checkbox = screen.getByTestId('connection-checkbox');
        await user.click(checkbox);

        expect(mockOnCheckboxChange).not.toHaveBeenCalled();
      });

      it('should not call onCheckboxChange when callback is not provided', async () => {
        const user = userEvent.setup();

        render(
          <ConnectionCard
            connection={{ ...mockConnection, status: 'allies' }}
            showCheckbox={true}
            isCheckboxEnabled={true}
            isChecked={false}
          />
        );

        const checkbox = screen.getByTestId('connection-checkbox');
        await user.click(checkbox);

        // Should not throw error
        expect(screen.getByTestId('connection-checkbox')).toBeInTheDocument();
      });
    });

    describe('Checkbox Accessibility', () => {
      it('should have proper aria-label for accessibility', () => {
        render(
          <ConnectionCard
            connection={{ ...mockConnection, status: 'allies' }}
            showCheckbox={true}
            isCheckboxEnabled={true}
            isChecked={false}
            onCheckboxChange={mockOnCheckboxChange}
          />
        );

        const checkbox = screen.getByTestId('connection-checkbox');
        expect(checkbox).toHaveAttribute('aria-label', 'Select John Doe for messaging');
      });

      it('should have proper styling classes for design system consistency', () => {
        render(
          <ConnectionCard
            connection={{ ...mockConnection, status: 'allies' }}
            showCheckbox={true}
            isCheckboxEnabled={true}
            isChecked={false}
            onCheckboxChange={mockOnCheckboxChange}
          />
        );

        const checkbox = screen.getByTestId('connection-checkbox');
        expect(checkbox).toHaveClass('data-[state=checked]:bg-blue-600', 'data-[state=checked]:border-blue-600');
      });
    });

    describe('Checkbox Layout', () => {
      it('should position checkbox before profile picture', () => {
        render(
          <ConnectionCard
            connection={{ ...mockConnection, status: 'allies' }}
            showCheckbox={true}
            isCheckboxEnabled={true}
            isChecked={false}
            onCheckboxChange={mockOnCheckboxChange}
          />
        );

        const checkbox = screen.getByTestId('connection-checkbox');
        const profileInitials = screen.getByText('JD');
        
        // Check that checkbox appears before profile initials in DOM order
        const checkboxParent = checkbox.closest('div');
        const profileParent = profileInitials.closest('div');
        
        expect(checkboxParent?.nextElementSibling).toBe(profileParent);
      });

      it('should maintain proper spacing when checkbox is present', () => {
        render(
          <ConnectionCard
            connection={{ ...mockConnection, status: 'allies' }}
            showCheckbox={true}
            isCheckboxEnabled={true}
            isChecked={false}
            onCheckboxChange={mockOnCheckboxChange}
          />
        );

        // Find the container with the flex layout that has space-x-4
        const flexContainer = screen.getByTestId('connection-checkbox').closest('div')?.parentElement;
        expect(flexContainer).toHaveClass('space-x-4');
      });
    });

    describe('Checkbox Edge Cases', () => {
      it('should handle rapid checkbox clicks gracefully', async () => {
        const user = userEvent.setup();

        render(
          <ConnectionCard
            connection={{ ...mockConnection, status: 'allies' }}
            showCheckbox={true}
            isCheckboxEnabled={true}
            isChecked={false}
            onCheckboxChange={mockOnCheckboxChange}
          />
        );

        const checkbox = screen.getByTestId('connection-checkbox');
        
        // Rapid clicks
        await user.click(checkbox);
        await user.click(checkbox);
        await user.click(checkbox);

        expect(mockOnCheckboxChange).toHaveBeenCalledTimes(3);
      });

      it('should work correctly with different connection names for aria-label', () => {
        const connectionWithSpecialChars = {
          ...mockConnection,
          first_name: "María José",
          last_name: "O'Connor-Smith",
          status: 'allies' as const
        };

        render(
          <ConnectionCard
            connection={connectionWithSpecialChars}
            showCheckbox={true}
            isCheckboxEnabled={true}
            isChecked={false}
            onCheckboxChange={mockOnCheckboxChange}
          />
        );

        const checkbox = screen.getByTestId('connection-checkbox');
        expect(checkbox).toHaveAttribute('aria-label', "Select María José O'Connor-Smith for messaging");
      });

      it('should handle missing connection name gracefully in aria-label', () => {
        const connectionWithoutName = {
          ...mockConnection,
          first_name: '',
          last_name: '',
          status: 'allies' as const
        };

        render(
          <ConnectionCard
            connection={connectionWithoutName}
            showCheckbox={true}
            isCheckboxEnabled={true}
            isChecked={false}
            onCheckboxChange={mockOnCheckboxChange}
          />
        );

        const checkbox = screen.getByTestId('connection-checkbox');
        expect(checkbox).toHaveAttribute('aria-label', 'Select   for messaging');
      });
    });
  });

  describe('Performance', () => {
    it('should render efficiently with large tag arrays', () => {
      const connectionWithManyTags = {
        ...mockConnection,
        tags: Array.from({ length: 50 }, (_, i) => `Tag${i}`)
      };

      const startTime = performance.now();
      render(
        <ConnectionCard
          connection={connectionWithManyTags}
          onSelect={mockOnSelect}
        />
      );
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(100); // Should render quickly
      expect(screen.getByText('Tag0')).toBeInTheDocument();
    });

    it('should handle rapid click events gracefully', async () => {
      const user = userEvent.setup();

      render(
        <ConnectionCard
          connection={mockConnection}
          onSelect={mockOnSelect}
        />
      );

      const card = screen.getByText('John Doe').closest('div')?.parentElement?.parentElement;
      
      // Rapid clicks
      await user.click(card!);
      await user.click(card!);
      await user.click(card!);

      expect(mockWindowOpen).toHaveBeenCalledTimes(3);
    });

    it('should render efficiently with checkbox functionality enabled', () => {
      const startTime = performance.now();
      render(
        <ConnectionCard
          connection={{ ...mockConnection, status: 'allies' }}
          showCheckbox={true}
          isCheckboxEnabled={true}
          isChecked={false}
          onCheckboxChange={mockOnCheckboxChange}
        />
      );
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(100); // Should render quickly
      expect(screen.getByTestId('connection-checkbox')).toBeInTheDocument();
    });
  });
});