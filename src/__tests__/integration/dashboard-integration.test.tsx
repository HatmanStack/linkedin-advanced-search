/**
 * Dashboard Integration Tests
 * 
 * Tests complete user flows across the connection management system including:
 * - Tab switching and state persistence
 * - Connection filtering and status updates
 * - Message modal interactions
 * - Error scenarios and recovery
 * - Virtual scrolling performance
 * - Accessibility compliance
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, within, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Dashboard from '@/pages/Dashboard';
import { AuthContext } from '@/contexts/AuthContext';
import { HealAndRestoreContext } from '@/contexts/HealAndRestoreContext';
import { LinkedInCredentialsContext } from '@/contexts/LinkedInCredentialsContext';
import { dbConnector } from '@/services/dbConnector';
import type { Connection, Message } from '@/types';

// Mock the services
vi.mock('@/services/dbConnector');
vi.mock('@/services/cognitoService');

// Mock react-window for virtual scrolling tests
vi.mock('react-window', () => ({
  FixedSizeList: ({ children, itemCount, itemSize, height }: any) => (
    <div 
      data-testid="virtual-list" 
      style={{ height }}
      role="list"
      aria-label={`Virtual list with ${itemCount} items`}
    >
      {Array.from({ length: Math.min(itemCount, 10) }, (_, index) => (
        <div key={index} style={{ height: itemSize }}>
          {children({ index, style: { height: itemSize } })}
        </div>
      ))}
    </div>
  ),
}));

// Mock data
const mockConnections: Connection[] = [
  {
    id: 'conn-1',
    first_name: 'John',
    last_name: 'Doe',
    position: 'Software Engineer',
    company: 'TechCorp',
    location: 'San Francisco, CA',
    headline: 'Building the future of software',
    status: 'incoming',
    messages: 5,
    date_added: '2024-01-15T10:00:00Z',
    linkedin_url: 'john-doe-engineer',
    tags: ['React', 'TypeScript'],
    recent_activity: 'Recently shared an article about React',
    common_interests: ['React', 'TypeScript', 'Web Development'],
    last_action_summary: 'Sent connection request'
  },
  {
    id: 'conn-2',
    first_name: 'Jane',
    last_name: 'Smith',
    position: 'Product Manager',
    company: 'StartupCo',
    location: 'New York, NY',
    headline: 'Product strategy and growth',
    status: 'outgoing',
    messages: 3,
    date_added: '2024-01-20T14:30:00Z',
    linkedin_url: 'jane-smith-pm',
    tags: ['Product Management', 'Strategy'],
    recent_activity: 'Posted about product roadmaps',
    common_interests: ['Product Management', 'Strategy', 'Growth'],
    last_action_summary: 'Received connection request'
  },
  {
    id: 'conn-3',
    first_name: 'Bob',
    last_name: 'Wilson',
    position: 'Designer',
    company: 'DesignStudio',
    location: 'Austin, TX',
    headline: 'Creating beautiful user experiences',
    status: 'allies',
    messages: 12,
    date_added: '2024-01-10T09:15:00Z',
    linkedin_url: 'bob-wilson-designer',
    tags: ['UI/UX', 'Design Systems'],
    recent_activity: 'Shared design inspiration',
    common_interests: ['UI/UX', 'Design Systems', 'Accessibility'],
    last_action_summary: 'Connected and exchanged messages'
  },
  {
    id: 'conn-4',
    first_name: 'Alice',
    last_name: 'Johnson',
    position: 'Data Scientist',
    company: 'DataCorp',
    location: 'Seattle, WA',
    headline: 'Turning data into insights',
    status: 'possible',
    conversion_likelihood: 75,
    date_added: '2024-01-25T16:45:00Z',
    linkedin_url: 'alice-johnson-data',
    tags: ['Data Science', 'Machine Learning'],
    recent_activity: 'Published research paper',
    common_interests: ['Data Science', 'Machine Learning', 'Python'],
    last_action_summary: 'Potential connection identified'
  }
];

const mockMessages: Message[] = [
  {
    id: 'msg-1',
    content: 'Hi John, thanks for connecting!',
    timestamp: '2024-01-15T10:30:00Z',
    sender: 'user'
  },
  {
    id: 'msg-2',
    content: 'Great to connect! I saw your work on React components.',
    timestamp: '2024-01-15T11:00:00Z',
    sender: 'connection'
  }
];

// Mock context providers
const mockAuthContext = {
  user: {
    id: 'user-123',
    email: 'test@example.com',
    firstName: 'Test',
    lastName: 'User'
  },
  signOut: vi.fn(),
  isAuthenticated: true,
  loading: false
};

const mockHealAndRestoreContext = {
  startListening: vi.fn(),
  stopListening: vi.fn(),
  isListening: false
};

const mockLinkedInCredentialsContext = {
  credentials: {
    email: 'test@linkedin.com',
    password: 'password123'
  },
  setCredentials: vi.fn(),
  clearCredentials: vi.fn()
};

// Test wrapper component
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  });

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthContext.Provider value={mockAuthContext}>
          <HealAndRestoreContext.Provider value={mockHealAndRestoreContext}>
            <LinkedInCredentialsContext.Provider value={mockLinkedInCredentialsContext}>
              {children}
            </LinkedInCredentialsContext.Provider>
          </HealAndRestoreContext.Provider>
        </AuthContext.Provider>
      </BrowserRouter>
    </QueryClientProvider>
  );
};

describe('Dashboard Integration Tests', () => {
  const user = userEvent.setup();

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();
    
    // Setup default mock implementations
    vi.mocked(dbConnector.getConnectionsByStatus).mockResolvedValue(mockConnections);
    vi.mocked(dbConnector.updateConnectionStatus).mockResolvedValue();
    vi.mocked(dbConnector.getMessageHistory).mockResolvedValue(mockMessages);
    
    // Mock localStorage for state persistence tests
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: vi.fn(),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn(),
      },
      writable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Complete User Flows', () => {
    it('should handle complete connection management flow', async () => {
      render(
        <TestWrapper>
          <Dashboard />
        </TestWrapper>
      );

      // Wait for initial data load
      await waitFor(() => {
        expect(screen.getByText('Your Connections')).toBeInTheDocument();
      });

      // Verify connections are loaded
      expect(dbConnector.getConnectionsByStatus).toHaveBeenCalledWith();
      
      // Test filtering connections
      const statusPicker = screen.getByRole('combobox', { name: /connection status/i });
      await user.click(statusPicker);
      
      const pendingOption = screen.getByRole('option', { name: /pending/i });
      await user.click(pendingOption);

      // Verify filtered connections are displayed
      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
        expect(screen.queryByText('Jane Smith')).not.toBeInTheDocument(); // outgoing status
      });

      // Test message modal interaction
      const messageButton = screen.getByRole('button', { name: /5 messages/i });
      await user.click(messageButton);

      // Verify message modal opens and loads messages
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.getByText('Messages with John Doe')).toBeInTheDocument();
      });

      expect(dbConnector.getMessageHistory).toHaveBeenCalledWith('conn-1');

      // Test sending a message
      const messageInput = screen.getByPlaceholderText(/type your message/i);
      const sendButton = screen.getByRole('button', { name: /send message/i });

      await user.type(messageInput, 'Test message');
      await user.click(sendButton);

      // Verify message appears in the list
      await waitFor(() => {
        expect(screen.getByText('Test message')).toBeInTheDocument();
      });

      // Close modal
      const closeButton = screen.getByRole('button', { name: /close/i });
      await user.click(closeButton);

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
    });

    it('should handle new connections tab workflow', async () => {
      render(
        <TestWrapper>
          <Dashboard />
        </TestWrapper>
      );

      // Switch to new connections tab
      const newConnectionsTab = screen.getByRole('tab', { name: /new connections/i });
      await user.click(newConnectionsTab);

      // Wait for tab content to load
      await waitFor(() => {
        expect(screen.getByText('New Connections')).toBeInTheDocument();
      });

      // Verify new connection is displayed
      expect(screen.getByText('Alice Johnson')).toBeInTheDocument();
      expect(screen.getByText('75% conversion likelihood')).toBeInTheDocument();

      // Test remove connection functionality
      const removeButton = screen.getByRole('button', { name: /remove connection/i });
      await user.click(removeButton);

      // Confirm removal in dialog
      const confirmButton = screen.getByRole('button', { name: /confirm/i });
      await user.click(confirmButton);

      // Verify API call and UI update
      await waitFor(() => {
        expect(dbConnector.updateConnectionStatus).toHaveBeenCalledWith('conn-4', 'processed');
        expect(screen.queryByText('Alice Johnson')).not.toBeInTheDocument();
      });
    });
  });

  describe('Tab Switching and State Persistence', () => {
    it('should maintain filter state when switching tabs', async () => {
      render(
        <TestWrapper>
          <Dashboard />
        </TestWrapper>
      );

      // Set a filter on connections tab
      const statusPicker = screen.getByRole('combobox', { name: /connection status/i });
      await user.click(statusPicker);
      
      const sentOption = screen.getByRole('option', { name: /sent/i });
      await user.click(sentOption);

      // Switch to new connections tab
      const newConnectionsTab = screen.getByRole('tab', { name: /new connections/i });
      await user.click(newConnectionsTab);

      // Switch back to connections tab
      const connectionsTab = screen.getByRole('tab', { name: /connections/i });
      await user.click(connectionsTab);

      // Verify filter state is maintained
      await waitFor(() => {
        expect(screen.getByDisplayValue(/sent/i)).toBeInTheDocument();
        expect(screen.getByText('Jane Smith')).toBeInTheDocument(); // outgoing status
        expect(screen.queryByText('John Doe')).not.toBeInTheDocument(); // incoming status
      });
    });

    it('should persist state across browser refresh simulation', async () => {
      // Mock localStorage to simulate state persistence
      const mockLocalStorage = {
        getItem: vi.fn().mockReturnValue(JSON.stringify({ selectedStatus: 'allies' })),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn(),
      };
      Object.defineProperty(window, 'localStorage', { value: mockLocalStorage });

      render(
        <TestWrapper>
          <Dashboard />
        </TestWrapper>
      );

      // Verify state is restored from localStorage
      await waitFor(() => {
        expect(screen.getByText('Bob Wilson')).toBeInTheDocument(); // allies status
        expect(screen.queryByText('John Doe')).not.toBeInTheDocument(); // incoming status
      });
    });
  });

  describe('Error Scenarios and Recovery', () => {
    it('should handle network errors gracefully', async () => {
      // Mock network error
      vi.mocked(dbConnector.getConnectionsByStatus).mockRejectedValue(
        new Error('Network error - unable to reach server')
      );

      render(
        <TestWrapper>
          <Dashboard />
        </TestWrapper>
      );

      // Verify error state is displayed
      await waitFor(() => {
        expect(screen.getByText('Failed to Load Connections')).toBeInTheDocument();
        expect(screen.getByText(/network error/i)).toBeInTheDocument();
      });

      // Test retry functionality
      const retryButton = screen.getByRole('button', { name: /try again/i });
      
      // Mock successful retry
      vi.mocked(dbConnector.getConnectionsByStatus).mockResolvedValue(mockConnections);
      
      await user.click(retryButton);

      // Verify recovery
      await waitFor(() => {
        expect(screen.getByText('Your Connections')).toBeInTheDocument();
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });
    });

    it('should handle API errors with proper user feedback', async () => {
      // Mock API error for status update
      vi.mocked(dbConnector.updateConnectionStatus).mockRejectedValue(
        new Error('Failed to update connection status')
      );

      render(
        <TestWrapper>
          <Dashboard />
        </TestWrapper>
      );

      // Wait for initial load
      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      // Switch to new connections tab and try to remove a connection
      const newConnectionsTab = screen.getByRole('tab', { name: /new connections/i });
      await user.click(newConnectionsTab);

      const removeButton = screen.getByRole('button', { name: /remove connection/i });
      await user.click(removeButton);

      const confirmButton = screen.getByRole('button', { name: /confirm/i });
      await user.click(confirmButton);

      // Verify error toast appears
      await waitFor(() => {
        expect(screen.getByText('Update Failed')).toBeInTheDocument();
        expect(screen.getByText(/failed to update connection status/i)).toBeInTheDocument();
      });

      // Verify optimistic update was rolled back
      expect(screen.getByText('Alice Johnson')).toBeInTheDocument();
    });

    it('should handle message loading errors', async () => {
      // Mock message loading error
      vi.mocked(dbConnector.getMessageHistory).mockRejectedValue(
        new Error('Failed to load message history')
      );

      render(
        <TestWrapper>
          <Dashboard />
        </TestWrapper>
      );

      // Click on message button
      const messageButton = screen.getByRole('button', { name: /5 messages/i });
      await user.click(messageButton);

      // Verify error handling in modal
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.getByText('Failed to Load Messages')).toBeInTheDocument();
      });
    });
  });

  describe('Data Consistency', () => {
    it('should maintain data consistency between UI and database', async () => {
      render(
        <TestWrapper>
          <Dashboard />
        </TestWrapper>
      );

      // Wait for initial load
      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      // Verify connection counts match data
      const statusPicker = screen.getByRole('combobox', { name: /connection status/i });
      await user.click(statusPicker);

      // Check that counts in the dropdown match the actual data
      const allOption = within(screen.getByRole('listbox')).getByText(/all statuses/i);
      expect(allOption).toBeInTheDocument();
      
      // Verify total count (should be 4 connections)
      expect(within(allOption.closest('[role="option"]')!).getByText('4')).toBeInTheDocument();

      // Test status update consistency
      await user.click(statusPicker); // Close dropdown
      
      // Switch to new connections and remove one
      const newConnectionsTab = screen.getByRole('tab', { name: /new connections/i });
      await user.click(newConnectionsTab);

      const removeButton = screen.getByRole('button', { name: /remove connection/i });
      await user.click(removeButton);

      const confirmButton = screen.getByRole('button', { name: /confirm/i });
      await user.click(confirmButton);

      // Verify database update was called with correct parameters
      await waitFor(() => {
        expect(dbConnector.updateConnectionStatus).toHaveBeenCalledWith('conn-4', 'processed');
      });

      // Switch back to connections tab and verify counts updated
      const connectionsTab = screen.getByRole('tab', { name: /connections/i });
      await user.click(connectionsTab);

      // The total should now be 3 (one connection was processed)
      await user.click(statusPicker);
      const updatedAllOption = within(screen.getByRole('listbox')).getByText(/all statuses/i);
      expect(within(updatedAllOption.closest('[role="option"]')!).getByText('3')).toBeInTheDocument();
    });
  });

  describe('Performance with Large Datasets', () => {
    it('should handle large datasets with virtual scrolling', async () => {
      // Create large dataset
      const largeDataset: Connection[] = Array.from({ length: 1000 }, (_, index) => ({
        id: `conn-${index}`,
        first_name: `User${index}`,
        last_name: `Test${index}`,
        position: 'Software Engineer',
        company: 'TechCorp',
        status: index % 3 === 0 ? 'incoming' : index % 3 === 1 ? 'outgoing' : 'allies',
        messages: Math.floor(Math.random() * 20),
        date_added: new Date().toISOString(),
        linkedin_url: `user-${index}`,
        tags: ['React', 'TypeScript'],
        recent_activity: 'Recent activity',
        common_interests: ['Programming'],
        last_action_summary: 'Test action'
      }));

      vi.mocked(dbConnector.getConnectionsByStatus).mockResolvedValue(largeDataset);

      const startTime = performance.now();
      
      render(
        <TestWrapper>
          <Dashboard />
        </TestWrapper>
      );

      // Wait for virtual list to render
      await waitFor(() => {
        expect(screen.getByTestId('virtual-list')).toBeInTheDocument();
      });

      const endTime = performance.now();
      const renderTime = endTime - startTime;

      // Verify performance is acceptable (should render in under 2 seconds)
      expect(renderTime).toBeLessThan(2000);

      // Verify virtual scrolling is working (only a subset of items should be rendered)
      const virtualList = screen.getByTestId('virtual-list');
      const renderedItems = within(virtualList).getAllByText(/User\d+/);
      
      // Should render only visible items (not all 1000)
      expect(renderedItems.length).toBeLessThan(50);
      expect(renderedItems.length).toBeGreaterThan(0);
    });

    it('should maintain performance during filtering operations', async () => {
      // Create large dataset with mixed statuses
      const largeDataset: Connection[] = Array.from({ length: 5000 }, (_, index) => ({
        id: `conn-${index}`,
        first_name: `User${index}`,
        last_name: `Test${index}`,
        position: 'Software Engineer',
        company: 'TechCorp',
        status: index % 4 === 0 ? 'incoming' : index % 4 === 1 ? 'outgoing' : index % 4 === 2 ? 'allies' : 'possible',
        messages: Math.floor(Math.random() * 20),
        date_added: new Date().toISOString(),
        linkedin_url: `user-${index}`,
        tags: ['React', 'TypeScript'],
        recent_activity: 'Recent activity',
        common_interests: ['Programming'],
        last_action_summary: 'Test action'
      }));

      vi.mocked(dbConnector.getConnectionsByStatus).mockResolvedValue(largeDataset);

      render(
        <TestWrapper>
          <Dashboard />
        </TestWrapper>
      );

      // Wait for initial render
      await waitFor(() => {
        expect(screen.getByTestId('virtual-list')).toBeInTheDocument();
      });

      // Test filtering performance
      const statusPicker = screen.getByRole('combobox', { name: /connection status/i });
      
      const startTime = performance.now();
      
      await user.click(statusPicker);
      const incomingOption = screen.getByRole('option', { name: /pending/i });
      await user.click(incomingOption);

      // Wait for filter to apply
      await waitFor(() => {
        expect(screen.getByDisplayValue(/pending/i)).toBeInTheDocument();
      });

      const endTime = performance.now();
      const filterTime = endTime - startTime;

      // Filtering should be fast (under 500ms)
      expect(filterTime).toBeLessThan(500);
    });
  });

  describe('Accessibility Compliance', () => {
    it('should support keyboard navigation', async () => {
      render(
        <TestWrapper>
          <Dashboard />
        </TestWrapper>
      );

      // Wait for initial load
      await waitFor(() => {
        expect(screen.getByText('Your Connections')).toBeInTheDocument();
      });

      // Test tab navigation
      const connectionsTab = screen.getByRole('tab', { name: /connections/i });
      const newConnectionsTab = screen.getByRole('tab', { name: /new connections/i });

      // Focus should start on first tab
      connectionsTab.focus();
      expect(document.activeElement).toBe(connectionsTab);

      // Arrow key navigation between tabs
      fireEvent.keyDown(connectionsTab, { key: 'ArrowRight' });
      expect(document.activeElement).toBe(newConnectionsTab);

      // Enter key should activate tab
      fireEvent.keyDown(newConnectionsTab, { key: 'Enter' });
      await waitFor(() => {
        expect(newConnectionsTab).toHaveAttribute('aria-selected', 'true');
      });

      // Test status picker keyboard navigation
      const statusPicker = screen.getByRole('combobox', { name: /connection status/i });
      statusPicker.focus();
      
      // Space or Enter should open dropdown
      fireEvent.keyDown(statusPicker, { key: ' ' });
      await waitFor(() => {
        expect(screen.getByRole('listbox')).toBeInTheDocument();
      });

      // Arrow keys should navigate options
      const firstOption = screen.getAllByRole('option')[0];
      expect(document.activeElement).toBe(firstOption);

      fireEvent.keyDown(firstOption, { key: 'ArrowDown' });
      const secondOption = screen.getAllByRole('option')[1];
      expect(document.activeElement).toBe(secondOption);
    });

    it('should have proper ARIA labels and roles', async () => {
      render(
        <TestWrapper>
          <Dashboard />
        </TestWrapper>
      );

      // Wait for initial load
      await waitFor(() => {
        expect(screen.getByText('Your Connections')).toBeInTheDocument();
      });

      // Check tab panel has proper ARIA attributes
      const tabPanel = screen.getByRole('tabpanel');
      expect(tabPanel).toHaveAttribute('aria-labelledby');

      // Check virtual list has proper ARIA attributes
      const virtualList = screen.getByTestId('virtual-list');
      expect(virtualList).toHaveAttribute('role', 'list');
      expect(virtualList).toHaveAttribute('aria-label');

      // Check status picker has proper labels
      const statusPicker = screen.getByRole('combobox', { name: /connection status/i });
      expect(statusPicker).toHaveAttribute('aria-labelledby');

      // Check connection cards have proper structure
      const connectionCards = screen.getAllByRole('article');
      connectionCards.forEach(card => {
        expect(card).toHaveAttribute('aria-labelledby');
      });
    });

    it('should support screen reader announcements', async () => {
      render(
        <TestWrapper>
          <Dashboard />
        </TestWrapper>
      );

      // Wait for initial load
      await waitFor(() => {
        expect(screen.getByText('Your Connections')).toBeInTheDocument();
      });

      // Check for live regions for dynamic updates
      const liveRegion = screen.getByRole('status', { hidden: true });
      expect(liveRegion).toBeInTheDocument();

      // Test status update announcement
      const newConnectionsTab = screen.getByRole('tab', { name: /new connections/i });
      await user.click(newConnectionsTab);

      const removeButton = screen.getByRole('button', { name: /remove connection/i });
      await user.click(removeButton);

      const confirmButton = screen.getByRole('button', { name: /confirm/i });
      await user.click(confirmButton);

      // Verify success message is announced
      await waitFor(() => {
        expect(screen.getByText('Connection Updated')).toBeInTheDocument();
      });
    });

    it('should have proper focus management in modals', async () => {
      render(
        <TestWrapper>
          <Dashboard />
        </TestWrapper>
      );

      // Wait for initial load and click message button
      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      const messageButton = screen.getByRole('button', { name: /5 messages/i });
      await user.click(messageButton);

      // Verify modal opens and focus is trapped
      await waitFor(() => {
        const modal = screen.getByRole('dialog');
        expect(modal).toBeInTheDocument();
        
        // Focus should be on the first focusable element in modal
        const closeButton = within(modal).getByRole('button', { name: /close/i });
        expect(document.activeElement).toBe(closeButton);
      });

      // Test Escape key closes modal
      fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
      
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });

      // Focus should return to the trigger button
      expect(document.activeElement).toBe(messageButton);
    });
  });
});