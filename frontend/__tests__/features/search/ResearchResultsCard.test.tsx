import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../utils';
import ResearchResultsCard from '@/features/search/components/ResearchResultsCard';

const RESEARCH_STORAGE_KEY = 'ai_research_content';

describe('ResearchResultsCard', () => {
  const user = userEvent.setup();
  const mockOnClear = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  describe('Visibility', () => {
    it('renders nothing when not researching and no stored content', () => {
      const { container } = renderWithProviders(
        <ResearchResultsCard isResearching={false} onClear={mockOnClear} />
      );

      expect(container.querySelector('.bg-white\\/5')).toBeNull();
    });

    it('renders when isResearching is true', () => {
      renderWithProviders(
        <ResearchResultsCard isResearching={true} onClear={mockOnClear} />
      );

      expect(screen.getByText('Research')).toBeInTheDocument();
    });

    it('renders when there is stored research content', async () => {
      sessionStorage.setItem(RESEARCH_STORAGE_KEY, 'Test research content');

      renderWithProviders(
        <ResearchResultsCard isResearching={false} onClear={mockOnClear} />
      );

      await waitFor(() => {
        expect(screen.getByText('Research')).toBeInTheDocument();
        expect(screen.getByText('Test research content')).toBeInTheDocument();
      });
    });
  });

  describe('Loading State', () => {
    it('shows "Research in progress" when researching', () => {
      renderWithProviders(
        <ResearchResultsCard isResearching={true} onClear={mockOnClear} />
      );

      expect(screen.getByText('Research in progress…')).toBeInTheDocument();
    });

    it('shows spinner when researching', () => {
      renderWithProviders(
        <ResearchResultsCard isResearching={true} onClear={mockOnClear} />
      );

      expect(screen.getByText('This may take several minutes.')).toBeInTheDocument();
      expect(document.querySelector('.animate-spin')).toBeInTheDocument();
    });

    it('shows "Research results" when not researching with content', async () => {
      sessionStorage.setItem(RESEARCH_STORAGE_KEY, 'Test content');

      renderWithProviders(
        <ResearchResultsCard isResearching={false} onClear={mockOnClear} />
      );

      await waitFor(() => {
        expect(screen.getByText('Research results')).toBeInTheDocument();
      });
    });
  });

  describe('Research Content Display', () => {
    it('displays stored research content', async () => {
      sessionStorage.setItem(RESEARCH_STORAGE_KEY, 'This is the research findings.');

      renderWithProviders(
        <ResearchResultsCard isResearching={false} onClear={mockOnClear} />
      );

      await waitFor(() => {
        expect(screen.getByText('This is the research findings.')).toBeInTheDocument();
      });
    });

    it('renders markdown content with ReactMarkdown', async () => {
      sessionStorage.setItem(RESEARCH_STORAGE_KEY, '# Heading\n\nSome paragraph text');

      renderWithProviders(
        <ResearchResultsCard isResearching={false} onClear={mockOnClear} />
      );

      await waitFor(() => {
        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Heading');
        expect(screen.getByText('Some paragraph text')).toBeInTheDocument();
      });
    });

    it('renders markdown lists', async () => {
      sessionStorage.setItem(RESEARCH_STORAGE_KEY, '- Item 1\n- Item 2\n- Item 3');

      renderWithProviders(
        <ResearchResultsCard isResearching={false} onClear={mockOnClear} />
      );

      await waitFor(() => {
        expect(screen.getByText('Item 1')).toBeInTheDocument();
        expect(screen.getByText('Item 2')).toBeInTheDocument();
        expect(screen.getByText('Item 3')).toBeInTheDocument();
      });
    });
  });

  describe('Clear Button', () => {
    it('shows clear button when there is content and not researching', async () => {
      sessionStorage.setItem(RESEARCH_STORAGE_KEY, 'Content to clear');

      renderWithProviders(
        <ResearchResultsCard isResearching={false} onClear={mockOnClear} />
      );

      await waitFor(() => {
        expect(screen.getByTitle('Clear research')).toBeInTheDocument();
      });
    });

    it('does not show clear button while researching', () => {
      sessionStorage.setItem(RESEARCH_STORAGE_KEY, 'Content');

      renderWithProviders(
        <ResearchResultsCard isResearching={true} onClear={mockOnClear} />
      );

      expect(screen.queryByTitle('Clear research')).not.toBeInTheDocument();
    });

    it('calls onClear and clears local state when clicked', async () => {
      sessionStorage.setItem(RESEARCH_STORAGE_KEY, 'Content to clear');

      renderWithProviders(
        <ResearchResultsCard isResearching={false} onClear={mockOnClear} />
      );

      await waitFor(() => {
        expect(screen.getByTitle('Clear research')).toBeInTheDocument();
      });

      await user.click(screen.getByTitle('Clear research'));

      expect(mockOnClear).toHaveBeenCalled();
    });
  });

  describe('Session Storage Integration', () => {
    it('reads from sessionStorage when not researching', async () => {
      sessionStorage.setItem(RESEARCH_STORAGE_KEY, 'Stored research');

      renderWithProviders(
        <ResearchResultsCard isResearching={false} onClear={mockOnClear} />
      );

      await waitFor(() => {
        expect(screen.getByText('Stored research')).toBeInTheDocument();
      });
    });

    it('handles missing sessionStorage item gracefully', () => {
      renderWithProviders(
        <ResearchResultsCard isResearching={false} onClear={mockOnClear} />
      );

      expect(screen.queryByText('Research')).not.toBeInTheDocument();
    });

    it('updates when isResearching changes to false', async () => {
      sessionStorage.setItem(RESEARCH_STORAGE_KEY, 'New research content');

      const { rerender } = renderWithProviders(
        <ResearchResultsCard isResearching={true} onClear={mockOnClear} />
      );

      expect(screen.getByText('Research in progress…')).toBeInTheDocument();

      rerender(
        <ResearchResultsCard isResearching={false} onClear={mockOnClear} />
      );

      await waitFor(() => {
        expect(screen.getByText('New research content')).toBeInTheDocument();
        expect(screen.getByText('Research results')).toBeInTheDocument();
      });
    });
  });

  describe('Card Structure', () => {
    it('has proper card header elements', async () => {
      sessionStorage.setItem(RESEARCH_STORAGE_KEY, 'Content');

      renderWithProviders(
        <ResearchResultsCard isResearching={false} onClear={mockOnClear} />
      );

      await waitFor(() => {
        expect(screen.getByText('Research')).toBeInTheDocument();
        expect(screen.getByText('Research results')).toBeInTheDocument();
      });
    });

    it('applies correct styling classes', async () => {
      sessionStorage.setItem(RESEARCH_STORAGE_KEY, 'Content');

      const { container } = renderWithProviders(
        <ResearchResultsCard isResearching={false} onClear={mockOnClear} />
      );

      await waitFor(() => {
        const card = container.querySelector('.bg-white\\/5');
        expect(card).toHaveClass('backdrop-blur-md');
        expect(card).toHaveClass('border-white/10');
      });
    });
  });
});
