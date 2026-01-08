import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ConversionLikelihoodBadge } from './ConversionLikelihoodBadge';

describe('ConversionLikelihoodBadge', () => {
  it('renders high likelihood with green styling', () => {
    render(<ConversionLikelihoodBadge likelihood="high" />);

    const badge = screen.getByText('High');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass('bg-green-100');
    expect(badge).toHaveClass('text-green-800');
  });

  it('renders medium likelihood with yellow styling', () => {
    render(<ConversionLikelihoodBadge likelihood="medium" />);

    const badge = screen.getByText('Medium');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass('bg-yellow-100');
    expect(badge).toHaveClass('text-yellow-800');
  });

  it('renders low likelihood with red styling', () => {
    render(<ConversionLikelihoodBadge likelihood="low" />);

    const badge = screen.getByText('Low');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass('bg-red-100');
    expect(badge).toHaveClass('text-red-800');
  });

  it('applies custom className', () => {
    render(<ConversionLikelihoodBadge likelihood="high" className="custom-class" />);

    const badge = screen.getByText('High');
    expect(badge).toHaveClass('custom-class');
  });
});
