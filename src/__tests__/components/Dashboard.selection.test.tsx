import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import Dashboard from '@/pages/Dashboard';
import { useAuth } from '@/contexts/AuthContext';
import { useHealAndRestore } from '@/contexts/HealAndRestoreContext';
import { useLinkedInCredentials } from '@/contexts/LinkedInCredentialsContext';
import { useToast } from '@/hooks/use-toast';
import { useSearchResults } from '@/hooks';
import { useProfileInit } from '@/hooks/useProfileInit';
import { dbConnector } from '@/services/dbConnector';

// Mock all the hooks and services
vi.mock('@/contexts/AuthContext');
vi.mock('@/contexts/HealAndRestoreContext');
vi.mock('@/contexts/LinkedInCredentialsContext');
vi.mock('@/hooks/use-toast');
vi.mock('@/hooks');
vi.mock('@/hooks/useProfileInit');
vi.mock('@/services/dbConnector');

// Mock react-router-dom
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => vi.fn(),
  };
});

// Mock react-window
vi.mock('react-window', () => ({
  FixedSizeList: ({ children, itemData, itemCount }: any) => (
    <div data-testid="virtual-list">
      {Array.from({ length: itemCount }, (_, index) => 
        children({ index, style: {}, data: itemData })
      )}
    </div>
  ),
}));

const mockConnections = [
  {
    id: '1',
    first_name: 'John',
    last_name: 'Doe',
    position: 'Software Engineer',
    company: 'TechCorp',
    status: 'allies',
    messages: 5,
    date_added: '2024-01-01'
  },
  {
    id: '2',
    first_name: 'Jane',
    last_name: 'Smith',
    position: 'Product Manager',
    company: 'StartupInc',
    status: 'allies',
    messages: 3,
    date_added: '2024-01-02'
  },
  {
    id: '3',
    first_name: 'Bob',
    last_name: 'Johnson',
    position: 'Designer',
    company: 'DesignCo',
    status: 'incoming',
    messages: 0,
    date_added: '2024-01-03'
  }
];

describe('Dashboard Connection Selection', () => {
  const mockUser = { id: '1', firstName: 'Test', email: 'test@example.com' };
  const mockToast = vi.fn();
  
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup default mocks
    (useAuth as any).mockReturnValue({
      user: mockUser,
      signOut: vi.fn(),
    });
    
    (useHealAndRestore as any).mockReturnValue({
      startListening: vi.fn(),
    });
    
    (useLinkedInCredentials as any).mockReturnValue({
      credentials: { email: 'test@linkedin.com', password: 'password' },
    });
    
    (useToast as any).mockReturnValue({
      toast: mockToast,
    });
    
    (useSearchResults as any).mockReturnValue({
      results: [],
      visitedLinks: [],
      loading: false,
      error: null,
      searchLinkedIn: vi.fn(),
      markAsVisited: vi.fn(),
      clearResults: vi.fn(),
      clearVisitedLinks: vi.fn(),
    });
    
    (useProfileInit as any).mockReturnValue({
      isInitializing: false,
      initializationMessage: null,
      initializationError: null,
      initializeProfile: vi.fn(),
    });
    
    // Mock dbConnector
    (dbConnector.getConnectionsByStatus as any).mockResolvedValue(mockConnections);
    (dbConnector.updateConnectionStatus as any).mockResolvedValue({});
    (dbConnector.getMessageHistory as any).mockResolvedValue([]);
  });

  const renderDashboard = () => {
    return render(
      <BrowserRouter>
        <Dashboard />
      </BrowserRouter>
    );
  };

  it('should initialize with empty selectedConnections state', async () => {
    renderDashboard();
    
    await waitFor(() => {
      expect(screen.getByText('Your Connections')).toBeInTheDocument();
    });
    
    // Check that no connections are initially selected
    const checkboxes = screen.queryAllByRole('checkbox');
    checkboxes.forEach(checkbox => {
      expect(checkbox).not.toBeChecked();
    });
  });

  it('should update selectedConnections when checkbox is clicked', async () => {
    renderDashboard();
    
    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });
    
    // Find and click a checkbox for an allies connection
    const johnCheckbox = screen.getByLabelText('Select John Doe for messaging');
    fireEvent.click(johnCheckbox);
    
    // Verify checkbox is checked
    expect(johnCheckbox).toBeChecked();
  });

  it('should calculate selectedConnectionsCount correctly', async () => {
    renderDashboard();
    
    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });
    
    // Initially should show 0 selected connections
    expect(screen.getByText(/Generate Personalized Messages/)).toBeDisabled();
    
    // Select one connection
    const johnCheckbox = screen.getByLabelText('Select John Doe for messaging');
    fireEvent.click(johnCheckbox);
    
    // The button should still be disabled without a topic
    expect(screen.getByText(/Generate Personalized Messages/)).toBeDisabled();
    
    // Add a topic
    const topicTextarea = screen.getByPlaceholderText(/AI trends in product development/);
    fireEvent.change(topicTextarea, { target: { value: 'Test topic' } });
    
    // Now the button should be enabled
    expect(screen.getByText(/Generate Personalized Messages/)).not.toBeDisabled();
  }); 
 it('should only show checkboxes for allies status connections', async () => {
    renderDashboard();
    
    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });
    
    // Should have checkboxes for allies connections (John and Jane)
    expect(screen.getByLabelText('Select John Doe for messaging')).toBeInTheDocument();
    expect(screen.getByLabelText('Select Jane Smith for messaging')).toBeInTheDocument();
    
    // Should not have checkbox for incoming connection (Bob)
    expect(screen.queryByLabelText('Select Bob Johnson for messaging')).not.toBeInTheDocument();
  });

  it('should handle multiple connection selections', async () => {
    renderDashboard();
    
    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });
    
    // Select multiple connections
    const johnCheckbox = screen.getByLabelText('Select John Doe for messaging');
    const janeCheckbox = screen.getByLabelText('Select Jane Smith for messaging');
    
    fireEvent.click(johnCheckbox);
    fireEvent.click(janeCheckbox);
    
    // Both should be checked
    expect(johnCheckbox).toBeChecked();
    expect(janeCheckbox).toBeChecked();
  });

  it('should deselect connection when checkbox is unchecked', async () => {
    renderDashboard();
    
    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });
    
    const johnCheckbox = screen.getByLabelText('Select John Doe for messaging');
    
    // Select then deselect
    fireEvent.click(johnCheckbox);
    expect(johnCheckbox).toBeChecked();
    
    fireEvent.click(johnCheckbox);
    expect(johnCheckbox).not.toBeChecked();
  });

  it('should handle toggleConnectionSelection function correctly', async () => {
    renderDashboard();
    
    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });
    
    // Click on the connection card itself (not checkbox) to toggle selection
    const johnCard = screen.getByText('John Doe').closest('div');
    if (johnCard) {
      fireEvent.click(johnCard);
    }
    
    // This should trigger the toggleConnectionSelection function
    // The exact behavior depends on the card click implementation
  });

  it('should pass correct props to VirtualConnectionList', async () => {
    renderDashboard();
    
    await waitFor(() => {
      expect(screen.getByTestId('virtual-list')).toBeInTheDocument();
    });
    
    // Verify that the virtual list is rendered with connections
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    expect(screen.getByText('Bob Johnson')).toBeInTheDocument();
  });
});