/**
 * Integration tests for RAGStack search flow
 *
 * Tests the full search flow from user input to results display
 * using mocked backend responses.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import React from 'react';

// Create mock functions before mocking modules
const mockSearchProfiles = vi.fn();

// Mock auth service
vi.mock('@/features/auth', () => ({
  CognitoAuthService: {
    getCurrentUserToken: vi.fn().mockResolvedValue('mock-jwt-token'),
  },
}));

// Mock the search service directly
vi.mock('@/shared/services/ragstackSearchService', () => ({
  searchProfiles: (...args: unknown[]) => mockSearchProfiles(...args),
}));

// Mock logger
vi.mock('@/shared/utils/logger', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

// Import components after mocks are set up
import { ConnectionSearchBar } from '../components/ConnectionSearchBar';
import { useProfileSearch } from '../hooks/useProfileSearch';
import type { Connection } from '@/shared/types';

// Create a test component that uses the search hook
const TestSearchComponent: React.FC<{ connections: Connection[] }> = ({ connections }) => {
  const {
    searchQuery,
    setSearchQuery,
    searchResults,
    isSearching,
    searchError,
    clearSearch,
    isSearchActive,
  } = useProfileSearch(connections);

  return (
    <div>
      <ConnectionSearchBar
        value={searchQuery}
        onChange={setSearchQuery}
        onClear={clearSearch}
        isLoading={isSearching}
        placeholder="Search connections..."
      />
      {searchError && (
        <div data-testid="search-error">Error: {searchError.message}</div>
      )}
      {isSearchActive && !isSearching && searchResults.length === 0 && !searchError && (
        <div data-testid="empty-results">No results found</div>
      )}
      <ul data-testid="results-list">
        {searchResults.map((result) => (
          <li key={result.id} data-testid={`result-${result.id}`}>
            {result.first_name} {result.last_name}
          </li>
        ))}
      </ul>
      <span data-testid="result-count">{searchResults.length}</span>
    </div>
  );
};

describe('Search Integration', () => {
  const mockConnections: Connection[] = [
    {
      id: 'conn-1',
      first_name: 'John',
      last_name: 'Doe',
      position: 'Software Engineer',
      company: 'TechCorp',
      status: 'ally',
    },
    {
      id: 'conn-2',
      first_name: 'Jane',
      last_name: 'Smith',
      position: 'Product Manager',
      company: 'DataCo',
      status: 'ally',
    },
    {
      id: 'conn-3',
      first_name: 'Bob',
      last_name: 'Wilson',
      position: 'Designer',
      company: 'DesignHub',
      status: 'ally',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Successful search flow', () => {
    it('should display search results after typing', async () => {
      mockSearchProfiles.mockResolvedValue({
        results: [
          { profileId: 'conn-1', score: 0.95, snippet: 'John Doe software engineer' },
        ],
        totalResults: 1,
      });

      render(<TestSearchComponent connections={mockConnections} />);

      const input = screen.getByRole('textbox');

      // Type search query
      act(() => {
        fireEvent.change(input, { target: { value: 'engineer' } });
      });

      // Advance past debounce
      await act(async () => {
        vi.advanceTimersByTime(350);
        await vi.runAllTimersAsync();
      });

      // Wait for results
      expect(screen.getByTestId('result-conn-1')).toBeInTheDocument();
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByTestId('result-count')).toHaveTextContent('1');
    });

    it('should filter to multiple matching results', async () => {
      mockSearchProfiles.mockResolvedValue({
        results: [
          { profileId: 'conn-1', score: 0.95, snippet: '' },
          { profileId: 'conn-2', score: 0.85, snippet: '' },
        ],
        totalResults: 2,
      });

      render(<TestSearchComponent connections={mockConnections} />);

      const input = screen.getByRole('textbox');

      act(() => {
        fireEvent.change(input, { target: { value: 'tech' } });
      });

      await act(async () => {
        vi.advanceTimersByTime(350);
        await vi.runAllTimersAsync();
      });

      expect(screen.getByTestId('result-count')).toHaveTextContent('2');
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    });
  });

  describe('Empty results', () => {
    it('should show empty state when no results found', async () => {
      mockSearchProfiles.mockResolvedValue({
        results: [],
        totalResults: 0,
      });

      render(<TestSearchComponent connections={mockConnections} />);

      const input = screen.getByRole('textbox');

      act(() => {
        fireEvent.change(input, { target: { value: 'nonexistent' } });
      });

      await act(async () => {
        vi.advanceTimersByTime(350);
        await vi.runAllTimersAsync();
      });

      expect(screen.getByTestId('empty-results')).toBeInTheDocument();
      expect(screen.getByText('No results found')).toBeInTheDocument();
    });
  });

  describe('Error handling', () => {
    it('should display error message on search failure', async () => {
      mockSearchProfiles.mockRejectedValue(new Error('Search API failed'));

      render(<TestSearchComponent connections={mockConnections} />);

      const input = screen.getByRole('textbox');

      act(() => {
        fireEvent.change(input, { target: { value: 'test' } });
      });

      await act(async () => {
        vi.advanceTimersByTime(350);
        await vi.runAllTimersAsync();
      });

      expect(screen.getByTestId('search-error')).toBeInTheDocument();
      expect(screen.getByText(/Search API failed/)).toBeInTheDocument();
    });
  });

  describe('Clear search', () => {
    it('should clear search when clear button clicked', async () => {
      mockSearchProfiles.mockResolvedValue({
        results: [{ profileId: 'conn-1', score: 0.95, snippet: '' }],
        totalResults: 1,
      });

      render(<TestSearchComponent connections={mockConnections} />);

      const input = screen.getByRole('textbox');

      // Perform search
      act(() => {
        fireEvent.change(input, { target: { value: 'john' } });
      });

      await act(async () => {
        vi.advanceTimersByTime(350);
        await vi.runAllTimersAsync();
      });

      expect(screen.getByTestId('result-count')).toHaveTextContent('1');

      // Clear search using clear button
      const clearButton = screen.getByRole('button', { name: /clear/i });
      act(() => {
        fireEvent.click(clearButton);
      });

      // Should show empty results (no search active)
      expect(screen.getByTestId('result-count')).toHaveTextContent('0');
      expect(input).toHaveValue('');
    });

    it('should clear search on Escape key', async () => {
      mockSearchProfiles.mockResolvedValue({
        results: [{ profileId: 'conn-1', score: 0.95, snippet: '' }],
        totalResults: 1,
      });

      render(<TestSearchComponent connections={mockConnections} />);

      const input = screen.getByRole('textbox');

      act(() => {
        fireEvent.change(input, { target: { value: 'john' } });
      });

      await act(async () => {
        vi.advanceTimersByTime(350);
        await vi.runAllTimersAsync();
      });

      expect(screen.getByTestId('result-count')).toHaveTextContent('1');

      // Press Escape
      act(() => {
        fireEvent.keyDown(input, { key: 'Escape' });
      });

      expect(input).toHaveValue('');
    });
  });

  describe('Loading state', () => {
    it('should show loading indicator during search', async () => {
      let resolveSearch: (value: unknown) => void;
      mockSearchProfiles.mockReturnValue(
        new Promise((resolve) => {
          resolveSearch = resolve;
        })
      );

      render(<TestSearchComponent connections={mockConnections} />);

      const input = screen.getByRole('textbox');

      act(() => {
        fireEvent.change(input, { target: { value: 'test' } });
      });

      await act(async () => {
        vi.advanceTimersByTime(350);
        await Promise.resolve(); // Let the search start
      });

      // Should show loading state
      expect(screen.getByRole('status')).toBeInTheDocument();

      // Resolve the search
      await act(async () => {
        resolveSearch!({
          results: [{ profileId: 'conn-1', score: 0.9, snippet: '' }],
          totalResults: 1,
        });
        await Promise.resolve();
      });

      // Loading should be gone
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });
  });

  describe('Debouncing', () => {
    it('should debounce rapid input', async () => {
      mockSearchProfiles.mockResolvedValue({
        results: [],
        totalResults: 0,
      });

      render(<TestSearchComponent connections={mockConnections} />);

      const input = screen.getByRole('textbox');

      // Type rapidly
      act(() => {
        fireEvent.change(input, { target: { value: 'a' } });
      });
      act(() => {
        vi.advanceTimersByTime(100);
      });
      act(() => {
        fireEvent.change(input, { target: { value: 'ab' } });
      });
      act(() => {
        vi.advanceTimersByTime(100);
      });
      act(() => {
        fireEvent.change(input, { target: { value: 'abc' } });
      });

      // Should not have called search yet
      expect(mockSearchProfiles).not.toHaveBeenCalled();

      // Advance past debounce
      await act(async () => {
        vi.advanceTimersByTime(350);
        await vi.runAllTimersAsync();
      });

      // Should only call once with final query
      expect(mockSearchProfiles).toHaveBeenCalledTimes(1);
      expect(mockSearchProfiles).toHaveBeenCalledWith('abc', 100);
    });
  });

  describe('Result ordering', () => {
    it('should preserve relevance order from API', async () => {
      // Return results in specific order (conn-2 first, then conn-1)
      mockSearchProfiles.mockResolvedValue({
        results: [
          { profileId: 'conn-2', score: 0.98, snippet: '' },
          { profileId: 'conn-1', score: 0.85, snippet: '' },
        ],
        totalResults: 2,
      });

      render(<TestSearchComponent connections={mockConnections} />);

      const input = screen.getByRole('textbox');

      act(() => {
        fireEvent.change(input, { target: { value: 'tech' } });
      });

      await act(async () => {
        vi.advanceTimersByTime(350);
        await vi.runAllTimersAsync();
      });

      expect(screen.getByTestId('result-count')).toHaveTextContent('2');

      // Check order - Jane (conn-2) should be first
      const results = screen.getAllByRole('listitem');
      expect(results[0]).toHaveTextContent('Jane Smith');
      expect(results[1]).toHaveTextContent('John Doe');
    });
  });
});
