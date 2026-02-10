/**
 * Unit tests for ConnectionSearchBar component
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConnectionSearchBar } from './ConnectionSearchBar';

describe('ConnectionSearchBar', () => {
  const defaultProps = {
    value: '',
    onChange: vi.fn(),
    onClear: vi.fn(),
    isLoading: false,
  };

  it('should render search input', () => {
    render(<ConnectionSearchBar {...defaultProps} />);

    expect(screen.getByRole('textbox')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/search/i)).toBeInTheDocument();
  });

  it('should display current value', () => {
    render(<ConnectionSearchBar {...defaultProps} value="test query" />);

    expect(screen.getByRole('textbox')).toHaveValue('test query');
  });

  it('should call onChange when typing', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<ConnectionSearchBar {...defaultProps} onChange={onChange} />);

    const input = screen.getByRole('textbox');
    await user.type(input, 'engineer');

    expect(onChange).toHaveBeenCalledTimes(8); // Once per character
  });

  it('should show clear button when value present', () => {
    render(<ConnectionSearchBar {...defaultProps} value="test" />);

    expect(screen.getByRole('button', { name: /clear/i })).toBeInTheDocument();
  });

  it('should not show clear button when value is empty', () => {
    render(<ConnectionSearchBar {...defaultProps} value="" />);

    expect(screen.queryByRole('button', { name: /clear/i })).not.toBeInTheDocument();
  });

  it('should call onClear when clear button clicked', async () => {
    const onClear = vi.fn();
    const user = userEvent.setup();
    render(<ConnectionSearchBar {...defaultProps} value="test" onClear={onClear} />);

    const clearButton = screen.getByRole('button', { name: /clear/i });
    await user.click(clearButton);

    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it('should show loading spinner when isLoading', () => {
    render(<ConnectionSearchBar {...defaultProps} value="test" isLoading={true} />);

    expect(screen.getByRole('status')).toBeInTheDocument();
    // Clear button should be hidden when loading
    expect(screen.queryByRole('button', { name: /clear/i })).not.toBeInTheDocument();
  });

  it('should not show loading spinner when not loading', () => {
    render(<ConnectionSearchBar {...defaultProps} value="test" isLoading={false} />);

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('should clear input on Escape key', () => {
    const onClear = vi.fn();
    render(<ConnectionSearchBar {...defaultProps} value="test" onClear={onClear} />);

    const input = screen.getByRole('textbox');
    fireEvent.keyDown(input, { key: 'Escape' });

    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it('should have accessible label', () => {
    render(<ConnectionSearchBar {...defaultProps} />);

    const input = screen.getByRole('textbox');
    expect(input).toHaveAttribute('aria-label');
  });

  it('should have aria-busy when loading', () => {
    render(<ConnectionSearchBar {...defaultProps} value="test" isLoading={true} />);

    const input = screen.getByRole('textbox');
    expect(input).toHaveAttribute('aria-busy', 'true');
  });

  it('should accept custom placeholder', () => {
    render(<ConnectionSearchBar {...defaultProps} placeholder="Find connections..." />);

    expect(screen.getByPlaceholderText('Find connections...')).toBeInTheDocument();
  });

  it('should accept custom className', () => {
    const { container } = render(
      <ConnectionSearchBar {...defaultProps} className="custom-class" />
    );

    expect(container.firstChild).toHaveClass('custom-class');
  });

  it('should show search icon', () => {
    render(<ConnectionSearchBar {...defaultProps} />);

    // The search icon should be present (via aria-hidden but still in DOM)
    const input = screen.getByRole('textbox');
    expect(input.parentElement?.querySelector('svg')).toBeInTheDocument();
  });
});
