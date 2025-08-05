/**
 * Performance and Stress Tests
 * 
 * Tests system performance under various stress conditions:
 * - Large dataset handling
 * - Virtual scrolling performance
 * - Memory usage optimization
 * - Concurrent operations
 * - Network latency simulation
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
import { connectionCache } from '@/utils/connectionCache';
import type { Connection, ConnectionStatus } from '@/types';

// Mock services
vi.mock('@/services/dbConnector');
vi.mock('@/services/cognitoService');

// Performance monitoring utilities
interface PerformanceMetrics {
  renderTime: number;
  memoryUsage: number;
  interactionTime: number;
  scrollPerformance: number;
}

const measurePerformance = async (operation: () => Promise<void>): Promise<PerformanceMetrics> => {
  const startTime = performance.now();
  const startMemory = (performance as any).memory?.usedJSHeapSize || 0;

  await operation();

  const endTime = performance.now();
  const endMemory = (performance as any).memory?.usedJSHeapSize || 0;

  return {
    renderTime: endTime - startTime,
    memoryUsage: endMemory - startMemory,
    interactionTime: endTime - startTime,
    scrollPerformance: endTime - startTime
  };
};

// Generate large datasets for stress testing
const generateLargeDataset = (size: number): Connection[] => {
  const statuses: ConnectionStatus[] = ['incoming', 'outgoing', 'allies', 'possible'];
  const companies = Array.from({ length: 100 }, (_, i) => `Company${i}`);
  const positions = Array.from({ length: 50 }, (_, i) => `Position${i}`);

  return Array.from({ length: size }, (_, index) => ({
    id: `stress-conn-${index}`,
    first_name: `User${index}`,
    last_name: `Test${index}`,
    position: positions[index % positions.length],
    company: companies[index % companies.length],
    location: `City${index % 20}, State${index % 50}`,
    headline: `Professional headline for user ${index}`,
    status: statuses[index % statuses.length],
    messages: Math.floor(Math.random() * 50),
    date_added: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString(),
    linkedin_url: `user-${index}`,
    tags: [`Tag${index % 10}`, `Tag${(index + 1) % 10}`],
    recent_activity: `Activity for user ${index}`,
    common_interests: [`Interest${index % 15}`, `Interest${(index + 1) % 15}`],
    last_action_summary: `Action summary ${index}`,
    conversion_likelihood: statuses[index % statuses.length] === 'possible' ? Math.floor(Math.random() * 100) : undefined
  }));
};

// Mock react-window with performance tracking
vi.mock('react-window', () => ({
  FixedSizeList: ({ children, itemCount, itemSize, height, onScroll }: any) => {
    const [scrollTop, setScrollTop] = React.useState(0);
    
    const handleScroll = (event: React.UIEvent<HTMLDivElement>) => {
      const newScrollTop = event.currentTarget.scrollTop;
      setScrollTop(newScrollTop);
      onScroll?.(event);
    };

    // Calculate visible range
    const startIndex = Math.floor(scrollTop / itemSize);
    const endIndex = Math.min(startIndex + Math.ceil(height / itemSize) + 2, itemCount);

    return (
      <div 
        data-testid="virtual-list"
        style={{ height, overflow: 'auto' }}
        onScroll={handleScroll}
        role="list"
        aria-label={`Virtual list with ${itemCount} items`}
      >
        {Array.from({ length: endIndex - startIndex }, (_, i) => {
          const index = startIndex + i;
          return (
            <div key={index} style={{ height: itemSize }}>
              {children({ index, style: { height: itemSize } })}
            </div>
          );
        })}
      </div>
    );
  },
}));

// Test wrapper
const StressTestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  });

  const mockAuthContext = {
    user: {
      id: 'stress-user-123',
      email: 'stress.test@example.com',
      firstName: 'Stress',
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
      email: 'stress.test@linkedin.com',
      password: 'stress-password123'
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

describe('Performance and Stress Tests', () => {
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Clear connection cache
    connectionCache.clear();
    
    // Mock performance.memory if not available
    if (!(performance as any).memory) {
      (performance as any).memory = {
        usedJSHeapSize: 10000000,
        totalJSHeapSize: 20000000,
        jsHeapSizeLimit: 100000000
      };
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Large Dataset Performance', () => {
    it('should handle 10,000 connections efficiently', async () => {
      const largeDataset = generateLargeDataset(10000);
      vi.mocked(dbConnector.getConnectionsByStatus).mockResolvedValue(largeDataset);

      const metrics = await measurePerformance(async () => {
        render(
          <StressTestWrapper>
            <Dashboard />
          </StressTestWrapper>
        );

        await waitFor(() => {
          expect(screen.getByText('Your Connections')).toBeInTheDocument();
        }, { timeout: 10000 });
      });

      // Performance assertions
      expect(metrics.renderTime).toBeLessThan(5000); // Should render in under 5 seconds
      expect(metrics.memoryUsage).toBeLessThan(50000000); // Should use less than 50MB additional memory

      // Verify virtual scrolling is working
      const virtualList = screen.getByTestId('virtual-list');
      expect(virtualList).toBeInTheDocument();

      // Should only render visible items, not all 10,000
      const renderedItems = within(virtualList).getAllByText(/User\d+/);
      expect(renderedItems.length).toBeLessThan(100); // Much less than total dataset
      expect(renderedItems.length).toBeGreaterThan(0);
    });

    it('should maintain performance during filtering with large datasets', async () => {
      const largeDataset = generateLargeDataset(5000);
      vi.mocked(dbConnector.getConnectionsByStatus).mockResolvedValue(largeDataset);

      render(
        <StressTestWrapper>
          <Dashboard />
        </StressTestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Your Connections')).toBeInTheDocument();
      });

      // Test filtering performance
      const statusPicker = screen.getByRole('combobox', { name: /connection status/i });

      const filterMetrics = await measurePerformance(async () => {
        await user.click(statusPicker);
        const incomingOption = screen.getByRole('option', { name: /pending/i });
        await user.click(incomingOption);

        await waitFor(() => {
          expect(screen.getByDisplayValue(/pending/i)).toBeInTheDocument();
        });
      });

      // Filtering should be fast even with large datasets
      expect(filterMetrics.interactionTime).toBeLessThan(1000);

      // Test multiple rapid filter changes
      const rapidFilterMetrics = await measurePerformance(async () => {
        for (let i = 0; i < 5; i++) {
          await user.click(statusPicker);
          const options = ['pending', 'sent', 'connections', 'all statuses'];
          const option = screen.getByRole('option', { name: new RegExp(options[i % options.length], 'i') });
          await user.click(option);
        }
      });

      expect(rapidFilterMetrics.interactionTime).toBeLessThan(2000);
    });

    it('should handle memory efficiently with connection cache', async () => {
      const largeDataset = generateLargeDataset(3000);
      vi.mocked(dbConnector.getConnectionsByStatus).mockResolvedValue(largeDataset);

      render(
        <StressTestWrapper>
          <Dashboard />
        </StressTestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Your Connections')).toBeInTheDocument();
      });

      // Verify cache is populated but limited
      const cacheSize = connectionCache.size();
      expect(cacheSize).toBeGreaterThan(0);
      expect(cacheSize).toBeLessThanOrEqual(1000); // Should respect cache size limit

      // Test cache efficiency with repeated access
      const cacheTestMetrics = await measurePerformance(async () => {
        // Simulate accessing the same connections multiple times
        for (let i = 0; i < 100; i++) {
          const connection = connectionCache.get(`stress-conn-${i}`);
          expect(connection).toBeDefined();
        }
      });

      expect(cacheTestMetrics.interactionTime).toBeLessThan(100); // Cache access should be very fast
    });
  });

  describe('Virtual Scrolling Performance', () => {
    it('should maintain smooth scrolling with large lists', async () => {
      const largeDataset = generateLargeDataset(2000);
      vi.mocked(dbConnector.getConnectionsByStatus).mockResolvedValue(largeDataset);

      render(
        <StressTestWrapper>
          <Dashboard />
        </StressTestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('virtual-list')).toBeInTheDocument();
      });

      const virtualList = screen.getByTestId('virtual-list');

      // Test scrolling performance
      const scrollMetrics = await measurePerformance(async () => {
        // Simulate rapid scrolling
        for (let i = 0; i < 10; i++) {
          fireEvent.scroll(virtualList, { target: { scrollTop: i * 1000 } });
          await new Promise(resolve => setTimeout(resolve, 50)); // Small delay to simulate real scrolling
        }
      });

      expect(scrollMetrics.scrollPerformance).toBeLessThan(1000); // Scrolling should be smooth

      // Verify only visible items are rendered during scroll
      const renderedItems = within(virtualList).getAllByText(/User\d+/);
      expect(renderedItems.length).toBeLessThan(50); // Should maintain small render count
    });

    it('should handle rapid scroll events without performance degradation', async () => {
      const largeDataset = generateLargeDataset(1500);
      vi.mocked(dbConnector.getConnectionsByStatus).mockResolvedValue(largeDataset);

      render(
        <StressTestWrapper>
          <Dashboard />
        </StressTestWrapper>
      );

      const virtualList = await screen.findByTestId('virtual-list');

      // Simulate very rapid scrolling (stress test)
      const rapidScrollMetrics = await measurePerformance(async () => {
        for (let i = 0; i < 50; i++) {
          fireEvent.scroll(virtualList, { target: { scrollTop: Math.random() * 10000 } });
        }
        
        // Wait for any pending updates
        await act(async () => {
          await new Promise(resolve => setTimeout(resolve, 100));
        });
      });

      expect(rapidScrollMetrics.scrollPerformance).toBeLessThan(500); // Should handle rapid scrolling efficiently
    });
  });

  describe('Concurrent Operations Stress Test', () => {
    it('should handle multiple simultaneous user interactions', async () => {
      const dataset = generateLargeDataset(1000);
      vi.mocked(dbConnector.getConnectionsByStatus).mockResolvedValue(dataset);
      vi.mocked(dbConnector.updateConnectionStatus).mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 100)); // Simulate network delay
      });

      render(
        <StressTestWrapper>
          <Dashboard />
        </StressTestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Your Connections')).toBeInTheDocument();
      });

      // Simulate concurrent operations
      const concurrentMetrics = await measurePerformance(async () => {
        const operations = [];

        // Tab switching
        operations.push(user.click(screen.getByRole('tab', { name: /new connections/i })));
        operations.push(user.click(screen.getByRole('tab', { name: /connections/i })));

        // Status filtering
        const statusPicker = screen.getByRole('combobox', { name: /connection status/i });
        operations.push(user.click(statusPicker));

        // Wait for all operations to complete
        await Promise.all(operations);

        // Additional rapid interactions
        if (screen.queryByRole('option', { name: /pending/i })) {
          await user.click(screen.getByRole('option', { name: /pending/i }));
        }
      });

      expect(concurrentMetrics.interactionTime).toBeLessThan(2000); // Should handle concurrent operations efficiently
    });

    it('should maintain data consistency during concurrent updates', async () => {
      const dataset = generateLargeDataset(500);
      vi.mocked(dbConnector.getConnectionsByStatus).mockResolvedValue(dataset);

      let updateCount = 0;
      vi.mocked(dbConnector.updateConnectionStatus).mockImplementation(async (connectionId, status) => {
        updateCount++;
        await new Promise(resolve => setTimeout(resolve, Math.random() * 200)); // Variable delay
        
        // Update mock data
        const connection = dataset.find(c => c.id === connectionId);
        if (connection) {
          connection.status = status as ConnectionStatus;
        }
      });

      render(
        <StressTestWrapper>
          <Dashboard />
        </StressTestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Your Connections')).toBeInTheDocument();
      });

      // Switch to new connections tab
      const newConnectionsTab = screen.getByRole('tab', { name: /new connections/i });
      await user.click(newConnectionsTab);

      // Perform multiple concurrent updates
      const possibleConnections = dataset.filter(c => c.status === 'possible').slice(0, 5);
      
      if (possibleConnections.length > 0) {
        const updatePromises = [];

        for (let i = 0; i < Math.min(3, possibleConnections.length); i++) {
          const removeButtons = screen.queryAllByRole('button', { name: /remove connection/i });
          if (removeButtons[i]) {
            updatePromises.push(
              user.click(removeButtons[i]).then(() => {
                const confirmButton = screen.getByRole('button', { name: /confirm/i });
                return user.click(confirmButton);
              })
            );
          }
        }

        // Wait for all updates to complete
        await Promise.all(updatePromises);

        // Verify all updates were processed
        await waitFor(() => {
          expect(updateCount).toBeGreaterThan(0);
        }, { timeout: 5000 });
      }
    });
  });

  describe('Memory Usage Optimization', () => {
    it('should not leak memory during extended usage', async () => {
      const dataset = generateLargeDataset(1000);
      vi.mocked(dbConnector.getConnectionsByStatus).mockResolvedValue(dataset);

      const initialMemory = (performance as any).memory.usedJSHeapSize;

      render(
        <StressTestWrapper>
          <Dashboard />
        </StressTestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Your Connections')).toBeInTheDocument();
      });

      // Simulate extended usage patterns
      for (let cycle = 0; cycle < 5; cycle++) {
        // Tab switching
        await user.click(screen.getByRole('tab', { name: /new connections/i }));
        await user.click(screen.getByRole('tab', { name: /connections/i }));

        // Filtering
        const statusPicker = screen.getByRole('combobox', { name: /connection status/i });
        await user.click(statusPicker);
        
        const options = screen.getAllByRole('option');
        if (options.length > 0) {
          await user.click(options[cycle % options.length]);
        }

        // Scrolling
        const virtualList = screen.getByTestId('virtual-list');
        fireEvent.scroll(virtualList, { target: { scrollTop: cycle * 500 } });

        // Small delay to allow for cleanup
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      const finalMemory = (performance as any).memory.usedJSHeapSize;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be reasonable (less than 20MB for extended usage)
      expect(memoryIncrease).toBeLessThan(20000000);
    });

    it('should efficiently manage connection cache under memory pressure', async () => {
      const largeDataset = generateLargeDataset(2000);
      vi.mocked(dbConnector.getConnectionsByStatus).mockResolvedValue(largeDataset);

      render(
        <StressTestWrapper>
          <Dashboard />
        </StressTestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Your Connections')).toBeInTheDocument();
      });

      // Access many connections to fill cache
      for (let i = 0; i < 1500; i++) {
        connectionCache.get(`stress-conn-${i}`);
      }

      // Verify cache respects size limits (LRU eviction)
      const cacheSize = connectionCache.size();
      expect(cacheSize).toBeLessThanOrEqual(1000); // Should not exceed max cache size

      // Verify most recently accessed items are still in cache
      const recentConnection = connectionCache.get('stress-conn-1499');
      expect(recentConnection).toBeDefined();

      // Older items should have been evicted
      const oldConnection = connectionCache.get('stress-conn-0');
      expect(oldConnection).toBeUndefined();
    });
  });

  describe('Network Latency Simulation', () => {
    it('should maintain responsiveness under high network latency', async () => {
      // Simulate high latency
      vi.mocked(dbConnector.getConnectionsByStatus).mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 3000)); // 3 second delay
        return generateLargeDataset(500);
      });

      const startTime = performance.now();

      render(
        <StressTestWrapper>
          <Dashboard />
        </StressTestWrapper>
      );

      // Verify loading state is shown immediately
      expect(screen.getByText(/loading/i)).toBeInTheDocument();

      // UI should remain responsive during loading
      const tabSwitchTime = performance.now();
      const newConnectionsTab = screen.getByRole('tab', { name: /new connections/i });
      await user.click(newConnectionsTab);
      const tabSwitchDuration = performance.now() - tabSwitchTime;

      expect(tabSwitchDuration).toBeLessThan(100); // Tab switching should be immediate

      // Wait for data to load
      await waitFor(() => {
        expect(screen.getByText('Your Connections')).toBeInTheDocument();
      }, { timeout: 5000 });

      const totalTime = performance.now() - startTime;
      expect(totalTime).toBeGreaterThan(3000); // Should respect the simulated delay
      expect(totalTime).toBeLessThan(4000); // But not much longer
    });

    it('should handle intermittent network issues gracefully', async () => {
      let callCount = 0;
      
      vi.mocked(dbConnector.getConnectionsByStatus).mockImplementation(async () => {
        callCount++;
        
        // Simulate intermittent failures
        if (callCount % 3 === 0) {
          throw new Error('Network timeout');
        }
        
        await new Promise(resolve => setTimeout(resolve, 500));
        return generateLargeDataset(300);
      });

      render(
        <StressTestWrapper>
          <Dashboard />
        </StressTestWrapper>
      );

      // Should eventually succeed despite intermittent failures
      await waitFor(() => {
        expect(screen.getByText('Your Connections')).toBeInTheDocument();
      }, { timeout: 10000 });

      // Verify retry logic was used
      expect(callCount).toBeGreaterThan(1);
    });
  });
});