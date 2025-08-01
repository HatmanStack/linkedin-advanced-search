/**
 * Frontend Component Tests for ConnectionsList
 * Task 10: End-to-end testing and validation - Frontend UI Testing
 * 
 * Tests the Initialize Profile Database button integration,
 * styling consistency, and user experience validation
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { jest } from '@jest/globals';
import ConnectionsList from '@/components/ConnectionsList';

// Mock the hooks
const mockUseConnections = jest.fn();
const mockUseProfileInit = jest.fn();

jest.mock('@/hooks/useConnections', () => ({
  useConnections: () => mockUseConnections()
}));

jest.mock('@/hooks/useProfileInit', () => ({
  useProfileInit: () => mockUseProfileInit()
}));

// Mock the UI components
jest.mock('@/components/ui/card', () => ({
  Card: ({ children, className }: any) => <div className={className} data-testid="card">{children}</div>,
  CardContent: ({ children }: any) => <div data-testid="card-content">{children}</div>,
  CardDescription: ({ children }: any) => <div data-testid="card-description">{children}</div>,
  CardHeader: ({ children }: any) => <div data-testid="card-header">{children}</div>,
  CardTitle: ({ children }: any) => <div data-testid="card-title">{children}</div>
}));

jest.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, className }: any) => (
    <button 
      onClick={onClick} 
      disabled={disabled} 
      className={className}
      data-testid="button"
    >
      {children}
    </button>
  )
}));

jest.mock('@/components/ui/input', () => ({
  Input: ({ placeholder, value, onChange, className }: any) => (
    <input 
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      className={className}
      data-testid="input"
    />
  )
}));

jest.mock('@/components/ui/badge', () => ({
  Badge: ({ children, onClick, className }: any) => (
    <span onClick={onClick} className={className} data-testid="badge">
      {children}
    </span>
  )
}));

jest.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({ children }: any) => <div data-testid="scroll-area">{children}</div>
}));

jest.mock('@/components/ui/select', () => ({
  Select: ({ children }: any) => <div data-testid="select">{children}</div>,
  SelectContent: ({ children }: any) => <div data-testid="select-content">{children}</div>,
  SelectItem: ({ children }: any) => <div data-testid="select-item">{children}</div>,
  SelectTrigger: ({ children }: any) => <div data-testid="select-trigger">{children}</div>,
  SelectValue: ({ children }: any) => <div data-testid="select-value">{children}</div>
}));

// Mock ConnectionCard component
jest.mock('@/components/ConnectionCard', () => {
  return function MockConnectionCard({ connection, onSelect, isSelected }: any) {
    return (
      <div 
        data-testid="connection-card"
        onClick={() => onSelect(connection.id)}
        className={isSelected ? 'selected' : ''}
      >
        {connection.first_name} {connection.last_name}
      </div>
    );
  };
});

// Mock icons
jest.mock('lucide-react', () => ({
  Search: () => <div data-testid="search-icon" />,
  Users: () => <div data-testid="users-icon" />,
  MessageSquare: () => <div data-testid="message-icon" />,
  Tag: () => <div data-testid="tag-icon" />,
  Calendar: () => <div data-testid="calendar-icon" />,
  Filter: () => <div data-testid="filter-icon" />,
  X: () => <div data-testid="x-icon" />,
  Database: () => <div data-testid="database-icon" />
}));

describe('ConnectionsList Component - Task 10 Frontend Testing', () => {
  const mockConnections = [
    {
      connection_id: 'test-1',
      user_id: 'user-1',
      first_name: 'John',
      last_name: 'Doe',
      position: 'Software Engineer',
      company: 'TechCorp',
      headline: 'Building great software',
      connection_status: 'connected',
      message_count: 5,
      tags: ['JavaScript', 'React'],
      last_activity_summary: 'Recently posted about React',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
      profile_picture_url: ''
    }
  ];

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Default mock implementations
    mockUseConnections.mockReturnValue({
      connections: mockConnections,
      loading: false,
      error: null,
      refetch: jest.fn()
    });

    mockUseProfileInit.mockReturnValue({
      isInitializing: false,
      initializationMessage: '',
      initializationError: '',
      initializeProfile: jest.fn(),
      clearMessages: jest.fn()
    });
  });

  describe('Initialize Profile Database Button - Requirements 1.1-1.4, 2.1-2.4', () => {
    test('should render Initialize Profile Database button', () => {
      render(<ConnectionsList />);
      
      const button = screen.getByText(/Initialize Profile Database/i);
      expect(button).toBeInTheDocument();
      expect(button).toHaveAttribute('data-testid', 'button');
    });

    test('should have consistent styling with gradient background', () => {
      render(<ConnectionsList />);
      
      const button = screen.getByText(/Initialize Profile Database/i);
      expect(button).toHaveClass('bg-gradient-to-r', 'from-green-600', 'to-teal-600');
    });

    test('should display database icon in button', () => {
      render(<ConnectionsList />);
      
      const databaseIcon = screen.getByTestId('database-icon');
      expect(databaseIcon).toBeInTheDocument();
    });

    test('should call initializeProfile when button is clicked', async () => {
      const mockInitializeProfile = jest.fn();
      mockUseProfileInit.mockReturnValue({
        isInitializing: false,
        initializationMessage: '',
        initializationError: '',
        initializeProfile: mockInitializeProfile,
        clearMessages: jest.fn()
      });

      render(<ConnectionsList />);
      
      const button = screen.getByText(/Initialize Profile Database/i);
      fireEvent.click(button);
      
      expect(mockInitializeProfile).toHaveBeenCalledTimes(1);
      expect(mockInitializeProfile).toHaveBeenCalledWith(expect.any(Function));
    });

    test('should show loading state when initializing', () => {
      mockUseProfileInit.mockReturnValue({
        isInitializing: true,
        initializationMessage: '',
        initializationError: '',
        initializeProfile: jest.fn(),
        clearMessages: jest.fn()
      });

      render(<ConnectionsList />);
      
      const button = screen.getByText(/Initializing.../i);
      expect(button).toBeInTheDocument();
      expect(button).toBeDisabled();
    });

    test('should display success message when initialization succeeds', () => {
      mockUseProfileInit.mockReturnValue({
        isInitializing: false,
        initializationMessage: 'Profile database initialized successfully!',
        initializationError: '',
        initializeProfile: jest.fn(),
        clearMessages: jest.fn()
      });

      render(<ConnectionsList />);
      
      const successMessage = screen.getByText(/Success:/);
      expect(successMessage).toBeInTheDocument();
      expect(screen.getByText(/Profile database initialized successfully!/)).toBeInTheDocument();
    });

    test('should display error message when initialization fails', () => {
      mockUseProfileInit.mockReturnValue({
        isInitializing: false,
        initializationMessage: '',
        initializationError: 'LinkedIn credentials are required',
        initializeProfile: jest.fn(),
        clearMessages: jest.fn()
      });

      render(<ConnectionsList />);
      
      const errorMessage = screen.getByText(/Error:/);
      expect(errorMessage).toBeInTheDocument();
      expect(screen.getByText(/LinkedIn credentials are required/)).toBeInTheDocument();
    });
  });

  describe('User Experience Consistency - Requirements 2.1-2.4, 7.3-7.6', () => {
    test('should maintain consistent card styling', () => {
      render(<ConnectionsList />);
      
      const card = screen.getByTestId('card');
      expect(card).toHaveClass('bg-white/5', 'backdrop-blur-md', 'border-white/10');
    });

    test('should show proper loading state', () => {
      mockUseConnections.mockReturnValue({
        connections: [],
        loading: true,
        error: null,
        refetch: jest.fn()
      });

      render(<ConnectionsList />);
      
      expect(screen.getByText(/Loading Connections.../)).toBeInTheDocument();
      expect(screen.getByTestId('card-title')).toBeInTheDocument();
    });

    test('should handle error state gracefully with demo data', () => {
      mockUseConnections.mockReturnValue({
        connections: [],
        loading: false,
        error: 'Connection failed',
        refetch: jest.fn()
      });

      render(<ConnectionsList />);
      
      expect(screen.getByText(/Error Loading Connections/)).toBeInTheDocument();
      expect(screen.getByText(/Connection Error:/)).toBeInTheDocument();
      expect(screen.getByText(/Demo Mode:/)).toBeInTheDocument();
    });

    test('should provide search functionality', () => {
      render(<ConnectionsList />);
      
      const searchInput = screen.getByPlaceholderText(/Search connections by name/);
      expect(searchInput).toBeInTheDocument();
      expect(screen.getByTestId('search-icon')).toBeInTheDocument();
    });

    test('should display connection count in title', () => {
      render(<ConnectionsList />);
      
      expect(screen.getByText(/Your Connections \(1\)/)).toBeInTheDocument();
    });
  });

  describe('Integration with useProfileInit Hook - Requirements 7.1-7.2', () => {
    test('should call refetch after successful initialization', async () => {
      const mockRefetch = jest.fn();
      const mockInitializeProfile = jest.fn((callback) => {
        // Simulate successful initialization
        callback();
      });

      mockUseConnections.mockReturnValue({
        connections: mockConnections,
        loading: false,
        error: null,
        refetch: mockRefetch
      });

      mockUseProfileInit.mockReturnValue({
        isInitializing: false,
        initializationMessage: '',
        initializationError: '',
        initializeProfile: mockInitializeProfile,
        clearMessages: jest.fn()
      });

      render(<ConnectionsList />);
      
      const button = screen.getByText(/Initialize Profile Database/i);
      fireEvent.click(button);
      
      expect(mockInitializeProfile).toHaveBeenCalledWith(expect.any(Function));
      expect(mockRefetch).toHaveBeenCalledTimes(1);
    });

    test('should handle initialization without callback', () => {
      const mockInitializeProfile = jest.fn();

      mockUseProfileInit.mockReturnValue({
        isInitializing: false,
        initializationMessage: '',
        initializationError: '',
        initializeProfile: mockInitializeProfile,
        clearMessages: jest.fn()
      });

      render(<ConnectionsList />);
      
      const button = screen.getByText(/Initialize Profile Database/i);
      fireEvent.click(button);
      
      expect(mockInitializeProfile).toHaveBeenCalledWith(expect.any(Function));
      expect(() => fireEvent.click(button)).not.toThrow();
    });
  });

  describe('Accessibility and Performance - Requirements 2.3-2.4', () => {
    test('should have proper button accessibility attributes', () => {
      render(<ConnectionsList />);
      
      const button = screen.getByText(/Initialize Profile Database/i);
      expect(button).toHaveAttribute('data-testid', 'button');
      expect(button).not.toHaveAttribute('aria-disabled', 'true');
    });

    test('should disable button during initialization for accessibility', () => {
      mockUseProfileInit.mockReturnValue({
        isInitializing: true,
        initializationMessage: '',
        initializationError: '',
        initializeProfile: jest.fn(),
        clearMessages: jest.fn()
      });

      render(<ConnectionsList />);
      
      const button = screen.getByText(/Initializing.../i);
      expect(button).toBeDisabled();
    });

    test('should provide proper visual feedback for different states', () => {
      // Test success state styling
      mockUseProfileInit.mockReturnValue({
        isInitializing: false,
        initializationMessage: 'Success message',
        initializationError: '',
        initializeProfile: jest.fn(),
        clearMessages: jest.fn()
      });

      const { rerender } = render(<ConnectionsList />);
      
      const successContainer = screen.getByText(/Success:/).closest('div');
      expect(successContainer).toHaveClass('bg-green-600/20', 'border-green-500/30');

      // Test error state styling
      mockUseProfileInit.mockReturnValue({
        isInitializing: false,
        initializationMessage: '',
        initializationError: 'Error message',
        initializeProfile: jest.fn(),
        clearMessages: jest.fn()
      });

      rerender(<ConnectionsList />);
      
      const errorContainer = screen.getByText(/Error:/).closest('div');
      expect(errorContainer).toHaveClass('bg-red-500/10', 'border-red-500/20');
    });
  });

  describe('Connection Display and Interaction - Requirements 4.3, 5.3', () => {
    test('should render connection cards', () => {
      render(<ConnectionsList />);
      
      const connectionCard = screen.getByTestId('connection-card');
      expect(connectionCard).toBeInTheDocument();
      expect(connectionCard).toHaveTextContent('John Doe');
    });

    test('should handle connection selection', () => {
      const mockOnConnectionSelect = jest.fn();
      
      render(<ConnectionsList onConnectionSelect={mockOnConnectionSelect} />);
      
      const connectionCard = screen.getByTestId('connection-card');
      fireEvent.click(connectionCard);
      
      expect(mockOnConnectionSelect).toHaveBeenCalledWith(
        expect.objectContaining({
          connection_id: 'test-1',
          first_name: 'John',
          last_name: 'Doe'
        })
      );
    });

    test('should display tag filters when tags are available', () => {
      render(<ConnectionsList />);
      
      expect(screen.getByText(/Filter by tags:/)).toBeInTheDocument();
      expect(screen.getByText('JavaScript')).toBeInTheDocument();
      expect(screen.getByText('React')).toBeInTheDocument();
    });

    test('should handle tag filtering', () => {
      render(<ConnectionsList />);
      
      const jsTag = screen.getByText('JavaScript');
      fireEvent.click(jsTag);
      
      // Tag should be clickable (no error thrown)
      expect(jsTag).toBeInTheDocument();
    });
  });

  describe('Error Handling and Edge Cases - Requirements 5.4, 6.1', () => {
    test('should handle empty connections list', () => {
      mockUseConnections.mockReturnValue({
        connections: [],
        loading: false,
        error: null,
        refetch: jest.fn()
      });

      render(<ConnectionsList />);
      
      expect(screen.getByText(/No connections found/)).toBeInTheDocument();
      expect(screen.getByText(/Start by searching for new connections/)).toBeInTheDocument();
    });

    test('should show demo data when server is unavailable', () => {
      mockUseConnections.mockReturnValue({
        connections: [],
        loading: false,
        error: 'Server unavailable',
        refetch: jest.fn()
      });

      render(<ConnectionsList />);
      
      expect(screen.getByText(/Demo Mode:/)).toBeInTheDocument();
      expect(screen.getByText(/sample data for demonstration/)).toBeInTheDocument();
    });

    test('should provide retry functionality on error', () => {
      const mockRefetch = jest.fn();
      
      mockUseConnections.mockReturnValue({
        connections: [],
        loading: false,
        error: 'Network error',
        refetch: mockRefetch
      });

      render(<ConnectionsList />);
      
      const retryButton = screen.getByText(/Try Again/);
      fireEvent.click(retryButton);
      
      expect(mockRefetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('Performance and Memory Management - Requirements 4.1, 4.2', () => {
    test('should handle large connection lists efficiently', () => {
      const largeConnectionList = Array.from({ length: 1000 }, (_, index) => ({
        connection_id: `test-${index}`,
        user_id: 'user-1',
        first_name: `User${index}`,
        last_name: 'Test',
        position: 'Engineer',
        company: 'TestCorp',
        headline: 'Test user',
        connection_status: 'connected',
        message_count: 1,
        tags: ['Test'],
        last_activity_summary: 'Test activity',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        profile_picture_url: ''
      }));

      mockUseConnections.mockReturnValue({
        connections: largeConnectionList,
        loading: false,
        error: null,
        refetch: jest.fn()
      });

      const startTime = performance.now();
      render(<ConnectionsList />);
      const endTime = performance.now();
      
      // Should render within reasonable time (less than 100ms)
      expect(endTime - startTime).toBeLessThan(100);
      
      // Should show correct count
      expect(screen.getByText(/Your Connections \(1000\)/)).toBeInTheDocument();
    });

    test('should use scroll area for large lists', () => {
      render(<ConnectionsList />);
      
      const scrollArea = screen.getByTestId('scroll-area');
      expect(scrollArea).toBeInTheDocument();
    });
  });
});

// Export test utilities for other tests
export const createMockConnection = (overrides = {}) => ({
  connection_id: 'mock-connection',
  user_id: 'mock-user',
  first_name: 'Mock',
  last_name: 'User',
  position: 'Mock Position',
  company: 'Mock Company',
  headline: 'Mock headline',
  connection_status: 'connected',
  message_count: 0,
  tags: [],
  last_activity_summary: 'Mock activity',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  profile_picture_url: '',
  ...overrides
});

export const createMockUseProfileInit = (overrides = {}) => ({
  isInitializing: false,
  initializationMessage: '',
  initializationError: '',
  initializeProfile: jest.fn(),
  clearMessages: jest.fn(),
  ...overrides
});

export const createMockUseConnections = (overrides = {}) => ({
  connections: [],
  loading: false,
  error: null,
  refetch: jest.fn(),
  ...overrides
});