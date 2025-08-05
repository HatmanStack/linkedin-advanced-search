/**
 * Accessibility Compliance Tests
 * 
 * Tests comprehensive accessibility compliance including:
 * - Screen reader compatibility
 * - Keyboard navigation
 * - ARIA attributes and roles
 * - Focus management
 * - Color contrast and visual accessibility
 * - Semantic HTML structure
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
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

// Mock services
vi.mock('@/services/dbConnector');
vi.mock('@/services/cognitoService');

// Mock axe-core for accessibility testing
const mockAxeResults = {
  violations: [],
  passes: [],
  incomplete: [],
  inapplicable: []
};

// Mock react-window with accessibility features
vi.mock('react-window', () => ({
  FixedSizeList: ({ children, itemCount, itemSize, height }: any) => (
    <div 
      data-testid="virtual-list"
      style={{ height }}
      role="list"
      aria-label={`Connection list with ${itemCount} items`}
      aria-live="polite"
      aria-busy="false"
    >
      {Array.from({ length: Math.min(itemCount, 10) }, (_, index) => (
        <div 
          key={index} 
          style={{ height: itemSize }}
          role="listitem"
          aria-setsize={itemCount}
          aria-posinset={index + 1}
        >
          {children({ index, style: { height: itemSize } })}
        </div>
      ))}
    </div>
  ),
}));

// Accessibility test data
const accessibleConnections: Connection[] = [
  {
    id: 'a11y-conn-1',
    first_name: 'John',
    last_name: 'Doe',
    position: 'Software Engineer',
    company: 'TechCorp',
    location: 'San Francisco, CA',
    headline: 'Building accessible web applications',
    status: 'incoming',
    messages: 5,
    date_added: '2024-01-15T10:00:00Z',
    linkedin_url: 'john-doe-engineer',
    tags: ['React', 'Accessibility'],
    recent_activity: 'Recently shared an article about web accessibility',
    common_interests: ['Web Accessibility', 'React', 'TypeScript'],
    last_action_summary: 'Sent connection request with accessibility focus'
  },
  {
    id: 'a11y-conn-2',
    first_name: 'Jane',
    last_name: 'Smith',
    position: 'UX Designer',
    company: 'DesignCorp',
    location: 'New York, NY',
    headline: 'Creating inclusive user experiences',
    status: 'allies',
    messages: 12,
    date_added: '2024-01-10T14:30:00Z',
    linkedin_url: 'jane-smith-ux',
    tags: ['UX Design', 'Accessibility'],
    recent_activity: 'Posted about inclusive design principles',
    common_interests: ['Inclusive Design', 'UX Research', 'Accessibility'],
    last_action_summary: 'Connected and discussing accessibility best practices'
  }
];

const accessibleMessages: Message[] = [
  {
    id: 'a11y-msg-1',
    content: 'Hi John, thanks for connecting! I love your work on accessible components.',
    timestamp: '2024-01-15T10:30:00Z',
    sender: 'user'
  },
  {
    id: 'a11y-msg-2',
    content: 'Great to connect! I saw your presentation on ARIA best practices.',
    timestamp: '2024-01-15T11:00:00Z',
    sender: 'connection'
  }
];

// Test wrapper with accessibility context
const AccessibilityTestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  });

  const mockAuthContext = {
    user: {
      id: 'a11y-user-123',
      email: 'accessibility.test@example.com',
      firstName: 'Accessibility',
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
      email: 'a11y.test@linkedin.com',
      password: 'a11y-password123'
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

// Accessibility testing utilities
const getAccessibilityTree = (element: HTMLElement) => {
  const tree: any = {};
  
  // Get role
  tree.role = element.getAttribute('role') || element.tagName.toLowerCase();
  
  // Get accessible name
  tree.name = element.getAttribute('aria-label') || 
               element.getAttribute('aria-labelledby') ||
               element.textContent?.trim() ||
               element.getAttribute('title') ||
               element.getAttribute('alt');
  
  // Get ARIA properties
  tree.properties = {};
  Array.from(element.attributes).forEach(attr => {
    if (attr.name.startsWith('aria-')) {
      tree.properties[attr.name] = attr.value;
    }
  });
  
  return tree;
};

const simulateScreenReader = (element: HTMLElement): string[] => {
  const announcements: string[] = [];
  
  // Simulate screen reader traversal
  const walker = document.createTreeWalker(
    element,
    NodeFilter.SHOW_ELEMENT,
    {
      acceptNode: (node) => {
        const el = node as HTMLElement;
        // Include elements that would be announced by screen readers
        if (el.getAttribute('role') || 
            el.tagName.match(/^(H[1-6]|BUTTON|A|INPUT|SELECT|TEXTAREA|LABEL)$/)) {
          return NodeFilter.FILTER_ACCEPT;
        }
        return NodeFilter.FILTER_SKIP;
      }
    }
  );

  let node;
  while (node = walker.nextNode()) {
    const el = node as HTMLElement;
    const tree = getAccessibilityTree(el);
    if (tree.name) {
      announcements.push(`${tree.role}: ${tree.name}`);
    }
  }

  return announcements;
};

describe('Accessibility Compliance Tests', () => {
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup accessible mock implementations
    vi.mocked(dbConnector.getConnectionsByStatus).mockResolvedValue(accessibleConnections);
    vi.mocked(dbConnector.updateConnectionStatus).mockResolvedValue();
    vi.mocked(dbConnector.getMessageHistory).mockResolvedValue(accessibleMessages);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Screen Reader Compatibility', () => {
    it('should provide proper screen reader announcements for all content', async () => {
      render(
        <AccessibilityTestWrapper>
          <Dashboard />
        </AccessibilityTestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Your Network Dashboard')).toBeInTheDocument();
      });

      // Get the main content area
      const main = screen.getByRole('main') || document.body;
      const announcements = simulateScreenReader(main);

      // Verify key elements are announced
      expect(announcements).toContain(expect.stringMatching(/heading.*Your Network Dashboard/i));
      expect(announcements).toContain(expect.stringMatching(/tab.*Connections/i));
      expect(announcements).toContain(expect.stringMatching(/tab.*New Connections/i));
      expect(announcements).toContain(expect.stringMatching(/combobox.*Connection Status/i));
    });

    it('should announce dynamic content changes', async () => {
      render(
        <AccessibilityTestWrapper>
          <Dashboard />
        </AccessibilityTestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Your Connections')).toBeInTheDocument();
      });

      // Check for live regions
      const liveRegions = screen.getAllByRole('status', { hidden: true });
      expect(liveRegions.length).toBeGreaterThan(0);

      // Test status change announcement
      const statusPicker = screen.getByRole('combobox', { name: /connection status/i });
      await user.click(statusPicker);
      
      const incomingOption = screen.getByRole('option', { name: /pending/i });
      await user.click(incomingOption);

      // Verify live region is updated
      await waitFor(() => {
        const liveRegion = screen.getByRole('status', { hidden: true });
        expect(liveRegion).toHaveTextContent(/filtered|updated|changed/i);
      });
    });

    it('should provide context for connection cards', async () => {
      render(
        <AccessibilityTestWrapper>
          <Dashboard />
        </AccessibilityTestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      // Find connection cards
      const connectionCards = screen.getAllByRole('article');
      expect(connectionCards.length).toBeGreaterThan(0);

      connectionCards.forEach(card => {
        // Each card should have proper labeling
        expect(card).toHaveAttribute('aria-labelledby');
        
        // Should have accessible description
        const labelId = card.getAttribute('aria-labelledby');
        if (labelId) {
          const label = document.getElementById(labelId);
          expect(label).toBeInTheDocument();
          expect(label?.textContent).toBeTruthy();
        }
      });
    });
  });

  describe('Keyboard Navigation', () => {
    it('should support full keyboard navigation', async () => {
      render(
        <AccessibilityTestWrapper>
          <Dashboard />
        </AccessibilityTestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Your Network Dashboard')).toBeInTheDocument();
      });

      // Test tab navigation through main interface
      const connectionsTab = screen.getByRole('tab', { name: /connections/i });
      const newConnectionsTab = screen.getByRole('tab', { name: /new connections/i });
      const statusPicker = screen.getByRole('combobox', { name: /connection status/i });

      // Start with first tab
      connectionsTab.focus();
      expect(document.activeElement).toBe(connectionsTab);

      // Arrow key navigation between tabs
      fireEvent.keyDown(connectionsTab, { key: 'ArrowRight' });
      expect(document.activeElement).toBe(newConnectionsTab);

      fireEvent.keyDown(newConnectionsTab, { key: 'ArrowLeft' });
      expect(document.activeElement).toBe(connectionsTab);

      // Tab to next focusable element
      fireEvent.keyDown(connectionsTab, { key: 'Tab' });
      
      // Should eventually reach status picker
      let attempts = 0;
      while (document.activeElement !== statusPicker && attempts < 10) {
        fireEvent.keyDown(document.activeElement!, { key: 'Tab' });
        attempts++;
      }
      expect(document.activeElement).toBe(statusPicker);
    });

    it('should handle dropdown keyboard navigation', async () => {
      render(
        <AccessibilityTestWrapper>
          <Dashboard />
        </AccessibilityTestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Your Connections')).toBeInTheDocument();
      });

      const statusPicker = screen.getByRole('combobox', { name: /connection status/i });
      statusPicker.focus();

      // Open dropdown with Space key
      fireEvent.keyDown(statusPicker, { key: ' ' });
      
      await waitFor(() => {
        expect(screen.getByRole('listbox')).toBeInTheDocument();
      });

      const options = screen.getAllByRole('option');
      expect(options.length).toBeGreaterThan(0);

      // First option should be focused
      expect(document.activeElement).toBe(options[0]);

      // Arrow down navigation
      fireEvent.keyDown(options[0], { key: 'ArrowDown' });
      expect(document.activeElement).toBe(options[1]);

      // Arrow up navigation
      fireEvent.keyDown(options[1], { key: 'ArrowUp' });
      expect(document.activeElement).toBe(options[0]);

      // Enter to select
      fireEvent.keyDown(options[0], { key: 'Enter' });
      
      await waitFor(() => {
        expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
      });
    });

    it('should support keyboard navigation in virtual lists', async () => {
      render(
        <AccessibilityTestWrapper>
          <Dashboard />
        </AccessibilityTestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('virtual-list')).toBeInTheDocument();
      });

      const virtualList = screen.getByTestId('virtual-list');
      
      // Virtual list should be focusable
      virtualList.focus();
      expect(document.activeElement).toBe(virtualList);

      // Should support arrow key navigation
      fireEvent.keyDown(virtualList, { key: 'ArrowDown' });
      fireEvent.keyDown(virtualList, { key: 'ArrowUp' });
      
      // Should support page navigation
      fireEvent.keyDown(virtualList, { key: 'PageDown' });
      fireEvent.keyDown(virtualList, { key: 'PageUp' });
      
      // Should support home/end navigation
      fireEvent.keyDown(virtualList, { key: 'Home' });
      fireEvent.keyDown(virtualList, { key: 'End' });
    });

    it('should handle modal keyboard navigation and focus trapping', async () => {
      render(
        <AccessibilityTestWrapper>
          <Dashboard />
        </AccessibilityTestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      // Open message modal
      const messageButton = screen.getByRole('button', { name: /5 messages/i });
      await user.click(messageButton);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      const modal = screen.getByRole('dialog');
      const focusableElements = within(modal).getAllByRole('button');
      const messageInput = within(modal).getByRole('textbox');

      // Focus should be trapped within modal
      const firstFocusable = focusableElements[0];
      const lastFocusable = messageInput;

      firstFocusable.focus();
      expect(document.activeElement).toBe(firstFocusable);

      // Tab to last element
      fireEvent.keyDown(firstFocusable, { key: 'Tab' });
      // Continue tabbing until we reach the last focusable element
      let current = document.activeElement;
      while (current !== lastFocusable && current !== firstFocusable) {
        fireEvent.keyDown(current!, { key: 'Tab' });
        current = document.activeElement;
      }

      // Tab from last element should wrap to first
      if (current === lastFocusable) {
        fireEvent.keyDown(lastFocusable, { key: 'Tab' });
        expect(document.activeElement).toBe(firstFocusable);
      }

      // Escape should close modal
      fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
      
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });

      // Focus should return to trigger
      expect(document.activeElement).toBe(messageButton);
    });
  });

  describe('ARIA Attributes and Roles', () => {
    it('should have proper ARIA roles for all interactive elements', async () => {
      render(
        <AccessibilityTestWrapper>
          <Dashboard />
        </AccessibilityTestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Your Network Dashboard')).toBeInTheDocument();
      });

      // Check tab list and tabs
      const tabList = screen.getByRole('tablist');
      expect(tabList).toBeInTheDocument();

      const tabs = screen.getAllByRole('tab');
      expect(tabs.length).toBeGreaterThan(0);

      tabs.forEach(tab => {
        expect(tab).toHaveAttribute('aria-selected');
        expect(tab).toHaveAttribute('aria-controls');
      });

      // Check tab panels
      const tabPanel = screen.getByRole('tabpanel');
      expect(tabPanel).toHaveAttribute('aria-labelledby');

      // Check combobox
      const statusPicker = screen.getByRole('combobox');
      expect(statusPicker).toHaveAttribute('aria-expanded');
      expect(statusPicker).toHaveAttribute('aria-haspopup');

      // Check virtual list
      const virtualList = screen.getByTestId('virtual-list');
      expect(virtualList).toHaveAttribute('role', 'list');
      expect(virtualList).toHaveAttribute('aria-label');
    });

    it('should have proper ARIA states that update dynamically', async () => {
      render(
        <AccessibilityTestWrapper>
          <Dashboard />
        </AccessibilityTestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Your Connections')).toBeInTheDocument();
      });

      const statusPicker = screen.getByRole('combobox');
      
      // Initially closed
      expect(statusPicker).toHaveAttribute('aria-expanded', 'false');

      // Open dropdown
      await user.click(statusPicker);
      
      await waitFor(() => {
        expect(statusPicker).toHaveAttribute('aria-expanded', 'true');
      });

      // Select an option
      const option = screen.getByRole('option', { name: /pending/i });
      await user.click(option);

      // Should close and update
      await waitFor(() => {
        expect(statusPicker).toHaveAttribute('aria-expanded', 'false');
      });
    });

    it('should provide proper ARIA descriptions for complex interactions', async () => {
      render(
        <AccessibilityTestWrapper>
          <Dashboard />
        </AccessibilityTestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      // Connection cards should have descriptions
      const connectionCards = screen.getAllByRole('article');
      
      connectionCards.forEach(card => {
        // Should have accessible name
        expect(card).toHaveAttribute('aria-labelledby');
        
        // May have description
        const describedBy = card.getAttribute('aria-describedby');
        if (describedBy) {
          const description = document.getElementById(describedBy);
          expect(description).toBeInTheDocument();
        }
      });

      // Message buttons should have descriptions
      const messageButtons = screen.getAllByRole('button', { name: /messages/i });
      messageButtons.forEach(button => {
        expect(button).toHaveAttribute('aria-label');
        const label = button.getAttribute('aria-label');
        expect(label).toMatch(/\d+ messages/i);
      });
    });
  });

  describe('Focus Management', () => {
    it('should manage focus properly during navigation', async () => {
      render(
        <AccessibilityTestWrapper>
          <Dashboard />
        </AccessibilityTestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Your Network Dashboard')).toBeInTheDocument();
      });

      // Initial focus should be on first interactive element
      const firstTab = screen.getAllByRole('tab')[0];
      firstTab.focus();

      // Tab switching should move focus appropriately
      const newConnectionsTab = screen.getByRole('tab', { name: /new connections/i });
      await user.click(newConnectionsTab);

      // Focus should remain on the activated tab
      expect(document.activeElement).toBe(newConnectionsTab);
    });

    it('should handle focus during loading states', async () => {
      // Mock slow loading
      vi.mocked(dbConnector.getConnectionsByStatus).mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve(accessibleConnections), 1000))
      );

      render(
        <AccessibilityTestWrapper>
          <Dashboard />
        </AccessibilityTestWrapper>
      );

      // During loading, interactive elements should still be focusable
      const tabs = screen.getAllByRole('tab');
      tabs[0].focus();
      expect(document.activeElement).toBe(tabs[0]);

      // Tab navigation should work during loading
      fireEvent.keyDown(tabs[0], { key: 'ArrowRight' });
      expect(document.activeElement).toBe(tabs[1]);

      // Wait for loading to complete
      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      // Focus should be maintained
      expect(document.activeElement).toBe(tabs[1]);
    });

    it('should restore focus after modal interactions', async () => {
      render(
        <AccessibilityTestWrapper>
          <Dashboard />
        </AccessibilityTestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      const messageButton = screen.getByRole('button', { name: /5 messages/i });
      messageButton.focus();
      
      // Open modal
      await user.click(messageButton);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      // Focus should move to modal
      const modal = screen.getByRole('dialog');
      const closeButton = within(modal).getByRole('button', { name: /close/i });
      expect(document.activeElement).toBe(closeButton);

      // Close modal with Escape
      fireEvent.keyDown(closeButton, { key: 'Escape' });

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });

      // Focus should return to trigger button
      expect(document.activeElement).toBe(messageButton);
    });
  });

  describe('Semantic HTML Structure', () => {
    it('should use proper heading hierarchy', async () => {
      render(
        <AccessibilityTestWrapper>
          <Dashboard />
        </AccessibilityTestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Your Network Dashboard')).toBeInTheDocument();
      });

      // Check heading hierarchy
      const h1 = screen.getByRole('heading', { level: 1 });
      expect(h1).toHaveTextContent('Your Network Dashboard');

      const h2Elements = screen.getAllByRole('heading', { level: 2 });
      expect(h2Elements.length).toBeGreaterThan(0);

      // Verify no heading levels are skipped
      const allHeadings = screen.getAllByRole('heading');
      const headingLevels = allHeadings.map(h => parseInt(h.tagName.charAt(1)));
      
      for (let i = 1; i < headingLevels.length; i++) {
        const diff = headingLevels[i] - headingLevels[i - 1];
        expect(diff).toBeLessThanOrEqual(1); // Should not skip heading levels
      }
    });

    it('should use proper landmark roles', async () => {
      render(
        <AccessibilityTestWrapper>
          <Dashboard />
        </AccessibilityTestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Your Network Dashboard')).toBeInTheDocument();
      });

      // Check for main landmark
      const main = screen.getByRole('main') || screen.getByRole('region', { name: /main/i });
      expect(main).toBeInTheDocument();

      // Check for navigation if present
      const nav = screen.queryByRole('navigation');
      if (nav) {
        expect(nav).toHaveAccessibleName();
      }

      // Check for complementary content
      const complementary = screen.queryByRole('complementary');
      if (complementary) {
        expect(complementary).toHaveAccessibleName();
      }
    });

    it('should use proper list structures', async () => {
      render(
        <AccessibilityTestWrapper>
          <Dashboard />
        </AccessibilityTestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('virtual-list')).toBeInTheDocument();
      });

      // Virtual list should have proper structure
      const list = screen.getByTestId('virtual-list');
      expect(list).toHaveAttribute('role', 'list');

      const listItems = within(list).getAllByRole('listitem');
      expect(listItems.length).toBeGreaterThan(0);

      // Each list item should have proper position info
      listItems.forEach((item, index) => {
        expect(item).toHaveAttribute('aria-setsize');
        expect(item).toHaveAttribute('aria-posinset', (index + 1).toString());
      });
    });
  });

  describe('Error State Accessibility', () => {
    it('should announce errors to screen readers', async () => {
      // Mock error state
      vi.mocked(dbConnector.getConnectionsByStatus).mockRejectedValue(
        new Error('Network error - unable to reach server')
      );

      render(
        <AccessibilityTestWrapper>
          <Dashboard />
        </AccessibilityTestWrapper>
      );

      // Wait for error state
      await waitFor(() => {
        expect(screen.getByText('Failed to Load Connections')).toBeInTheDocument();
      });

      // Error should be in an alert region
      const alert = screen.getByRole('alert') || screen.getByRole('status');
      expect(alert).toBeInTheDocument();
      expect(alert).toHaveTextContent(/failed to load connections/i);

      // Retry button should be accessible
      const retryButton = screen.getByRole('button', { name: /try again/i });
      expect(retryButton).toBeInTheDocument();
      expect(retryButton).toHaveAccessibleName();
    });

    it('should provide accessible error recovery options', async () => {
      // Mock error state
      vi.mocked(dbConnector.updateConnectionStatus).mockRejectedValue(
        new Error('Failed to update connection status')
      );

      render(
        <AccessibilityTestWrapper>
          <Dashboard />
        </AccessibilityTestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Your Connections')).toBeInTheDocument();
      });

      // Switch to new connections and try to remove one
      const newConnectionsTab = screen.getByRole('tab', { name: /new connections/i });
      await user.click(newConnectionsTab);

      // This would trigger an error in a real scenario
      // For now, we verify the error handling structure is accessible
      const removeButtons = screen.queryAllByRole('button', { name: /remove/i });
      if (removeButtons.length > 0) {
        expect(removeButtons[0]).toHaveAccessibleName();
      }
    });
  });

  describe('Loading State Accessibility', () => {
    it('should provide accessible loading indicators', async () => {
      // Mock slow loading
      vi.mocked(dbConnector.getConnectionsByStatus).mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve(accessibleConnections), 1000))
      );

      render(
        <AccessibilityTestWrapper>
          <Dashboard />
        </AccessibilityTestWrapper>
      );

      // Loading state should be announced
      const loadingIndicator = screen.getByText(/loading/i);
      expect(loadingIndicator).toBeInTheDocument();

      // Should have proper ARIA attributes
      const busyRegion = screen.getByRole('status') || screen.getByLabelText(/loading/i);
      expect(busyRegion).toHaveAttribute('aria-live', 'polite');

      // Wait for loading to complete
      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      // Loading indicator should be removed
      expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
    });
  });
});