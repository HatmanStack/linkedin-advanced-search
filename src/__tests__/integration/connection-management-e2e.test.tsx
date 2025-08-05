/**
 * End-to-End Connection Management Tests
 * 
 * Tests complete user scenarios across the entire connection management system:
 * - Full user workflows from login to connection management
 * - Cross-component interactions and data flow
 * - Real API integration scenarios
 * - Performance under realistic conditions
 * - Error recovery and resilience
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, within, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Dashboard from '@/pages/Dashboard';
import { AuthContext } from '@/contexts/AuthContext';
import { HealAndRestoreContext } from '@/contexts/HealAndRestoreContext';
import { LinkedInCredentialsContext } from '@/contexts/LinkedInCredentialsContext';
import { dbConnector, ApiError } from '@/services/dbConnector';
import type { Connection, Message, ConnectionStatus } from '@/types';

// Mock the services with more realistic behavior
vi.mock('@/services/dbConnector');
vi.mock('@/services/cognitoService');

// Mock network conditions for testing
interface NetworkCondition {
  latency: number;
  errorRate: number;
  timeoutRate: number;
}

const networkConditions: Record<string, NetworkCondition> = {
  good: { latency: 100, errorRate: 0, timeoutRate: 0 },
  slow: { latency: 2000, errorRate: 0.1, timeoutRate: 0.05 },
  poor: { latency: 5000, errorRate: 0.3, timeoutRate: 0.2 },
  offline: { latency: 0, errorRate: 1, timeoutRate: 0 }
};

// Realistic test data that simulates real LinkedIn connections
const generateRealisticConnections = (count: number): Connection[] => {
  const companies = ['Google', 'Microsoft', 'Apple', 'Amazon', 'Meta', 'Netflix', 'Tesla', 'Spotify'];
  const positions = ['Software Engineer', 'Product Manager', 'Designer', 'Data Scientist', 'DevOps Engineer'];
  const locations = ['San Francisco, CA', 'New York, NY', 'Seattle, WA', 'Austin, TX', 'Boston, MA'];
  const statuses: ConnectionStatus[] = ['incoming', 'outgoing', 'allies', 'possible'];

  return Array.from({ length: count }, (_, index) => ({
    id: `realistic-conn-${index}`,
    first_name: `User${index}`,
    last_name: `Test${index}`,
    position: positions[index % positions.length],
    company: companies[index % companies.length],
    location: locations[index % locations.length],
    headline: `Experienced ${positions[index % positions.length]} at ${companies[index % companies.length]}`,
    status: statuses[index % statuses.length],
    messages: Math.floor(Math.random() * 25),
    date_added: new Date(Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000).toISOString(),
    linkedin_url: `user-${index}-test`,
    tags: ['React', 'TypeScript', 'Node.js'].slice(0, Math.floor(Math.random() * 3) + 1),
    recent_activity: `Recently shared insights about ${positions[index % positions.length]}`,
    common_interests: ['Technology', 'Innovation', 'Startups'].slice(0, Math.floor(Math.random() * 3) + 1),
    last_action_summary: `Last interaction: ${Math.floor(Math.random() * 30)} days ago`,
    conversion_likelihood: statuses[index % statuses.length] === 'possible' ? Math.floor(Math.random() * 100) : undefined
  }));
};

// Mock realistic message history
const generateRealisticMessages = (connectionId: string, count: number): Message[] => {
  const messageTemplates = [
    "Thanks for connecting!",
    "Great to meet you at the conference.",
    "I saw your post about React - very insightful!",
    "Would love to chat about your experience at {company}.",
    "Hope you're doing well!",
    "Interesting article you shared about {topic}."
  ];

  return Array.from({ length: count }, (_, index) => ({
    id: `msg-${connectionId}-${index}`,
    content: messageTemplates[index % messageTemplates.length],
    timestamp: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
    sender: index % 2 === 0 ? 'user' : 'connection'
  }));
};

// Network simulation utilities
const simulateNetworkCondition = (condition: NetworkCondition) => {
  return new Promise((resolve, reject) => {
    // Simulate latency
    setTimeout(() => {
      // Simulate errors
      if (Math.random() < condition.errorRate) {
        reject(new ApiError({
          message: 'Network error - request failed',
          status: Math.random() < 0.5 ? 500 : 503
        }));
        return;
      }

      // Simulate timeouts
      if (Math.random() < condition.timeoutRate) {
        reject(new ApiError({
          message: 'Request timeout',
          code: 'ECONNABORTED'
        }));
        return;
      }

      resolve(true);
    }, condition.latency);
  });
};

// Test wrapper with realistic context
const E2ETestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { 
        retry: 3,
        retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000)
      },
      mutations: { 
        retry: 2,
        retryDelay: 1000
      }
    }
  });

  const mockAuthContext = {
    user: {
      id: 'e2e-user-123',
      email: 'e2e.test@example.com',
      firstName: 'E2E',
      lastName: 'TestUser'
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
      email: 'e2e.test@linkedin.com',
      password: 'e2e-password123'
    },
    setCredentials: vi.fn(),
    clearCredentials: vi.fn()
  };

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

describe('End-to-End Connection Management Tests', () => {
  const user = userEvent.setup();
  let realisticConnections: Connection[];

  beforeAll(() => {
    // Generate realistic test data
    realisticConnections = generateRealisticConnections(100);
  });

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup realistic mock implementations
    vi.mocked(dbConnector.getConnectionsByStatus).mockImplementation(async (status) => {
      await simulateNetworkCondition(networkConditions.good);
      
      if (status) {
        return realisticConnections.filter(conn => conn.status === status);
      }
      return realisticConnections;
    });

    vi.mocked(dbConnector.updateConnectionStatus).mockImplementation(async (connectionId, newStatus) => {
      await simulateNetworkCondition(networkConditions.good);
      
      // Update the mock data to simulate real database update
      const connectionIndex = realisticConnections.findIndex(conn => conn.id === connectionId);
      if (connectionIndex !== -1) {
        realisticConnections[connectionIndex].status = newStatus as ConnectionStatus;
      }
    });

    vi.mocked(dbConnector.getMessageHistory).mockImplementation(async (connectionId) => {
      await simulateNetworkCondition(networkConditions.good);
      
      const connection = realisticConnections.find(conn => conn.id === connectionId);
      if (connection) {
        return generateRealisticMessages(connectionId, connection.messages || 0);
      }
      return [];
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Complete User Workflows', () => {
    it('should handle complete connection discovery and management workflow', async () => {
      render(
        <E2ETestWrapper>
          <Dashboard />
        </E2ETestWrapper>
      );

      // Step 1: Initial dashboard load
      await waitFor(() => {
        expect(screen.getByText('Your Network Dashboard')).toBeInTheDocument();
      }, { timeout: 5000 });

      // Verify connections are loaded
      expect(dbConnector.getConnectionsByStatus).toHaveBeenCalledWith();
      
      // Step 2: Explore different connection types
      const statusPicker = screen.getByRole('combobox', { name: /connection status/i });
      
      // Test each status filter
      const statusTests = [
        { status: 'incoming', label: 'Pending' },
        { status: 'outgoing', label: 'Sent' },
        { status: 'allies', label: 'Connections' }
      ];

      for (const { status, label } of statusTests) {
        await user.click(statusPicker);
        const option = screen.getByRole('option', { name: new RegExp(label, 'i') });
        await user.click(option);

        // Verify filtered results
        await waitFor(() => {
          const filteredConnections = realisticConnections.filter(conn => conn.status === status);
          if (filteredConnections.length > 0) {
            expect(screen.getByText(filteredConnections[0].first_name)).toBeInTheDocument();
          }
        });
      }

      // Step 3: Interact with a connection
      await user.click(statusPicker);
      const allOption = screen.getByRole('option', { name: /all statuses/i });
      await user.click(allOption);

      // Find a connection with messages
      const connectionWithMessages = realisticConnections.find(conn => (conn.messages || 0) > 0);
      if (connectionWithMessages) {
        const messageButton = screen.getByRole('button', { 
          name: new RegExp(`${connectionWithMessages.messages} messages`, 'i') 
        });
        await user.click(messageButton);

        // Verify message modal opens
        await waitFor(() => {
          expect(screen.getByRole('dialog')).toBeInTheDocument();
          expect(screen.getByText(`Messages with ${connectionWithMessages.first_name} ${connectionWithMessages.last_name}`)).toBeInTheDocument();
        });

        // Test message interaction
        const messageInput = screen.getByPlaceholderText(/type your message/i);
        await user.type(messageInput, 'This is an end-to-end test message');
        
        const sendButton = screen.getByRole('button', { name: /send message/i });
        await user.click(sendButton);

        // Verify message appears
        await waitFor(() => {
          expect(screen.getByText('This is an end-to-end test message')).toBeInTheDocument();
        });

        // Close modal
        const closeButton = screen.getByRole('button', { name: /close/i });
        await user.click(closeButton);
      }

      // Step 4: Test new connections workflow
      const newConnectionsTab = screen.getByRole('tab', { name: /new connections/i });
      await user.click(newConnectionsTab);

      // Find a possible connection
      const possibleConnection = realisticConnections.find(conn => conn.status === 'possible');
      if (possibleConnection) {
        await waitFor(() => {
          expect(screen.getByText(possibleConnection.first_name)).toBeInTheDocument();
        });

        // Test remove functionality
        const removeButton = screen.getByRole('button', { name: /remove connection/i });
        await user.click(removeButton);

        const confirmButton = screen.getByRole('button', { name: /confirm/i });
        await user.click(confirmButton);

        // Verify API call and UI update
        await waitFor(() => {
          expect(dbConnector.updateConnectionStatus).toHaveBeenCalledWith(possibleConnection.id, 'processed');
          expect(screen.queryByText(possibleConnection.first_name)).not.toBeInTheDocument();
        });
      }
    });

    it('should handle LinkedIn search and connection discovery', async () => {
      render(
        <E2ETestWrapper>
          <Dashboard />
        </E2ETestWrapper>
      );

      // Navigate to new connections tab
      const newConnectionsTab = screen.getByRole('tab', { name: /new connections/i });
      await user.click(newConnectionsTab);

      // Test LinkedIn search functionality
      const companyInput = screen.getByPlaceholderText(/company name/i);
      const jobInput = screen.getByPlaceholderText(/job title/i);
      const locationInput = screen.getByPlaceholderText(/location/i);

      await user.type(companyInput, 'Google');
      await user.type(jobInput, 'Software Engineer');
      await user.type(locationInput, 'San Francisco');

      const searchButton = screen.getByRole('button', { name: /search linkedin/i });
      await user.click(searchButton);

      // Verify search is initiated
      await waitFor(() => {
        expect(screen.getByText(/searching/i)).toBeInTheDocument();
      });

      // Note: In a real E2E test, this would trigger actual LinkedIn search
      // For this integration test, we verify the UI behavior
    });
  });

  describe('Network Resilience and Error Recovery', () => {
    it('should handle slow network conditions gracefully', async () => {
      // Simulate slow network
      vi.mocked(dbConnector.getConnectionsByStatus).mockImplementation(async () => {
        await simulateNetworkCondition(networkConditions.slow);
        return realisticConnections;
      });

      const startTime = performance.now();

      render(
        <E2ETestWrapper>
          <Dashboard />
        </E2ETestWrapper>
      );

      // Verify loading state is shown
      expect(screen.getByText(/loading/i)).toBeInTheDocument();

      // Wait for slow network response
      await waitFor(() => {
        expect(screen.getByText('Your Connections')).toBeInTheDocument();
      }, { timeout: 10000 });

      const endTime = performance.now();
      const totalTime = endTime - startTime;

      // Verify it handled the slow network (should be around 2 seconds + render time)
      expect(totalTime).toBeGreaterThan(2000);
      expect(totalTime).toBeLessThan(5000); // But not too slow due to good UX
    });

    it('should recover from network failures with retry logic', async () => {
      let attemptCount = 0;
      
      // Simulate network failure followed by success
      vi.mocked(dbConnector.getConnectionsByStatus).mockImplementation(async () => {
        attemptCount++;
        
        if (attemptCount <= 2) {
          // First two attempts fail
          throw new ApiError({
            message: 'Network error - unable to reach server',
            status: 503
          });
        }
        
        // Third attempt succeeds
        return realisticConnections;
      });

      render(
        <E2ETestWrapper>
          <Dashboard />
        </E2ETestWrapper>
      );

      // Should eventually succeed after retries
      await waitFor(() => {
        expect(screen.getByText('Your Connections')).toBeInTheDocument();
      }, { timeout: 15000 });

      // Verify retry logic was used
      expect(attemptCount).toBeGreaterThan(1);
      expect(dbConnector.getConnectionsByStatus).toHaveBeenCalledTimes(attemptCount);
    });

    it('should handle complete network failure with proper error states', async () => {
      // Simulate complete network failure
      vi.mocked(dbConnector.getConnectionsByStatus).mockImplementation(async () => {
        await simulateNetworkCondition(networkConditions.offline);
        throw new ApiError({
          message: 'Network error - unable to reach server',
          code: 'NETWORK_ERROR'
        });
      });

      render(
        <E2ETestWrapper>
          <Dashboard />
        </E2ETestWrapper>
      );

      // Verify error state is displayed
      await waitFor(() => {
        expect(screen.getByText('Failed to Load Connections')).toBeInTheDocument();
        expect(screen.getByText(/network error/i)).toBeInTheDocument();
      }, { timeout: 10000 });

      // Test manual retry
      const retryButton = screen.getByRole('button', { name: /try again/i });
      
      // Mock recovery
      vi.mocked(dbConnector.getConnectionsByStatus).mockResolvedValue(realisticConnections);
      
      await user.click(retryButton);

      // Verify recovery
      await waitFor(() => {
        expect(screen.getByText('Your Connections')).toBeInTheDocument();
      });
    });
  });

  describe('Performance Under Load', () => {
    it('should maintain performance with realistic dataset sizes', async () => {
      // Generate large realistic dataset
      const largeRealisticDataset = generateRealisticConnections(2000);
      
      vi.mocked(dbConnector.getConnectionsByStatus).mockResolvedValue(largeRealisticDataset);

      const startTime = performance.now();

      render(
        <E2ETestWrapper>
          <Dashboard />
        </E2ETestWrapper>
      );

      // Wait for initial render
      await waitFor(() => {
        expect(screen.getByText('Your Connections')).toBeInTheDocument();
      });

      const initialRenderTime = performance.now() - startTime;

      // Test filtering performance with large dataset
      const filterStartTime = performance.now();
      
      const statusPicker = screen.getByRole('combobox', { name: /connection status/i });
      await user.click(statusPicker);
      
      const incomingOption = screen.getByRole('option', { name: /pending/i });
      await user.click(incomingOption);

      await waitFor(() => {
        expect(screen.getByDisplayValue(/pending/i)).toBeInTheDocument();
      });

      const filterTime = performance.now() - filterStartTime;

      // Performance assertions
      expect(initialRenderTime).toBeLessThan(3000); // Initial render under 3s
      expect(filterTime).toBeLessThan(1000); // Filtering under 1s

      // Test tab switching performance
      const tabSwitchStartTime = performance.now();
      
      const newConnectionsTab = screen.getByRole('tab', { name: /new connections/i });
      await user.click(newConnectionsTab);

      await waitFor(() => {
        expect(screen.getByText('New Connections')).toBeInTheDocument();
      });

      const tabSwitchTime = performance.now() - tabSwitchStartTime;
      expect(tabSwitchTime).toBeLessThan(500); // Tab switching under 500ms
    });

    it('should handle concurrent user interactions efficiently', async () => {
      render(
        <E2ETestWrapper>
          <Dashboard />
        </E2ETestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Your Connections')).toBeInTheDocument();
      });

      // Simulate rapid user interactions
      const statusPicker = screen.getByRole('combobox', { name: /connection status/i });
      const newConnectionsTab = screen.getByRole('tab', { name: /new connections/i });
      const connectionsTab = screen.getByRole('tab', { name: /connections/i });

      const startTime = performance.now();

      // Rapid tab switching and filtering
      await user.click(newConnectionsTab);
      await user.click(connectionsTab);
      await user.click(statusPicker);
      
      const incomingOption = screen.getByRole('option', { name: /pending/i });
      await user.click(incomingOption);
      
      await user.click(statusPicker);
      const allOption = screen.getByRole('option', { name: /all statuses/i });
      await user.click(allOption);

      const endTime = performance.now();
      const totalInteractionTime = endTime - startTime;

      // Should handle rapid interactions smoothly
      expect(totalInteractionTime).toBeLessThan(2000);
      
      // Verify final state is correct
      expect(screen.getByDisplayValue(/all statuses/i)).toBeInTheDocument();
    });
  });

  describe('Data Integrity and Consistency', () => {
    it('should maintain data consistency across complex user workflows', async () => {
      render(
        <E2ETestWrapper>
          <Dashboard />
        </E2ETestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Your Connections')).toBeInTheDocument();
      });

      // Get initial counts
      const statusPicker = screen.getByRole('combobox', { name: /connection status/i });
      await user.click(statusPicker);
      
      const allOptionInitial = within(screen.getByRole('listbox')).getByText(/all statuses/i);
      const initialTotalText = within(allOptionInitial.closest('[role="option"]')!).getByText(/\d+/);
      const initialTotal = parseInt(initialTotalText.textContent || '0');

      await user.click(statusPicker); // Close dropdown

      // Perform multiple status updates
      const newConnectionsTab = screen.getByRole('tab', { name: /new connections/i });
      await user.click(newConnectionsTab);

      // Remove multiple connections
      const possibleConnections = realisticConnections.filter(conn => conn.status === 'possible');
      let removedCount = 0;

      for (let i = 0; i < Math.min(3, possibleConnections.length); i++) {
        const removeButtons = screen.queryAllByRole('button', { name: /remove connection/i });
        if (removeButtons.length > 0) {
          await user.click(removeButtons[0]);
          
          const confirmButton = screen.getByRole('button', { name: /confirm/i });
          await user.click(confirmButton);
          
          await waitFor(() => {
            expect(dbConnector.updateConnectionStatus).toHaveBeenCalledWith(
              possibleConnections[i].id, 
              'processed'
            );
          });
          
          removedCount++;
        }
      }

      // Switch back to connections tab and verify counts
      const connectionsTab = screen.getByRole('tab', { name: /connections/i });
      await user.click(connectionsTab);

      await user.click(statusPicker);
      const allOptionFinal = within(screen.getByRole('listbox')).getByText(/all statuses/i);
      const finalTotalText = within(allOptionFinal.closest('[role="option"]')!).getByText(/\d+/);
      const finalTotal = parseInt(finalTotalText.textContent || '0');

      // Verify count consistency
      expect(finalTotal).toBe(initialTotal - removedCount);
    });

    it('should handle optimistic updates with rollback on failure', async () => {
      render(
        <E2ETestWrapper>
          <Dashboard />
        </E2ETestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Your Connections')).toBeInTheDocument();
      });

      // Switch to new connections
      const newConnectionsTab = screen.getByRole('tab', { name: /new connections/i });
      await user.click(newConnectionsTab);

      const possibleConnection = realisticConnections.find(conn => conn.status === 'possible');
      if (possibleConnection) {
        // Mock API failure
        vi.mocked(dbConnector.updateConnectionStatus).mockRejectedValue(
          new ApiError({
            message: 'Failed to update connection status',
            status: 500
          })
        );

        const removeButton = screen.getByRole('button', { name: /remove connection/i });
        await user.click(removeButton);

        const confirmButton = screen.getByRole('button', { name: /confirm/i });
        await user.click(confirmButton);

        // Verify error handling and rollback
        await waitFor(() => {
          expect(screen.getByText('Update Failed')).toBeInTheDocument();
          // Connection should still be visible (rollback)
          expect(screen.getByText(possibleConnection.first_name)).toBeInTheDocument();
        });
      }
    });
  });

  describe('Cross-Component Integration', () => {
    it('should maintain state consistency across all components', async () => {
      render(
        <E2ETestWrapper>
          <Dashboard />
        </E2ETestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Your Connections')).toBeInTheDocument();
      });

      // Test that status picker, connection list, and counts all stay in sync
      const statusPicker = screen.getByRole('combobox', { name: /connection status/i });
      
      // Filter to incoming connections
      await user.click(statusPicker);
      const incomingOption = screen.getByRole('option', { name: /pending/i });
      await user.click(incomingOption);

      // Verify all components reflect the filter
      await waitFor(() => {
        expect(screen.getByDisplayValue(/pending/i)).toBeInTheDocument();
        
        const incomingConnections = realisticConnections.filter(conn => conn.status === 'incoming');
        if (incomingConnections.length > 0) {
          expect(screen.getByText(incomingConnections[0].first_name)).toBeInTheDocument();
        }
      });

      // Test message modal integration
      const incomingConnections = realisticConnections.filter(conn => conn.status === 'incoming');
      const connectionWithMessages = incomingConnections.find(conn => (conn.messages || 0) > 0);
      
      if (connectionWithMessages) {
        const messageButton = screen.getByRole('button', { 
          name: new RegExp(`${connectionWithMessages.messages} messages`, 'i') 
        });
        await user.click(messageButton);

        // Verify modal opens with correct connection data
        await waitFor(() => {
          expect(screen.getByRole('dialog')).toBeInTheDocument();
          expect(screen.getByText(`Messages with ${connectionWithMessages.first_name} ${connectionWithMessages.last_name}`)).toBeInTheDocument();
        });

        // Verify message history is loaded
        expect(dbConnector.getMessageHistory).toHaveBeenCalledWith(connectionWithMessages.id);

        // Close modal and verify state is maintained
        const closeButton = screen.getByRole('button', { name: /close/i });
        await user.click(closeButton);

        await waitFor(() => {
          expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
          // Filter should still be active
          expect(screen.getByDisplayValue(/pending/i)).toBeInTheDocument();
        });
      }
    });
  });
});