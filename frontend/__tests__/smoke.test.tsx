import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders, createMockUser, createMockConnection } from './utils';

describe('Test Infrastructure Smoke Tests', () => {
  describe('Basic Assertions', () => {
    it('passes a basic assertion', () => {
      expect(true).toBe(true);
    });

    it('handles arithmetic correctly', () => {
      expect(1 + 1).toBe(2);
    });

    it('handles string comparison', () => {
      expect('hello').toBe('hello');
    });
  });

  describe('jest-dom Matchers', () => {
    it('can use toBeInTheDocument matcher', () => {
      const TestComponent = () => <div data-testid="test-element">Hello</div>;
      renderWithProviders(<TestComponent />);
      expect(screen.getByTestId('test-element')).toBeInTheDocument();
    });

    it('can use toHaveTextContent matcher', () => {
      const TestComponent = () => <span>Test Content</span>;
      renderWithProviders(<TestComponent />);
      expect(screen.getByText('Test Content')).toHaveTextContent('Test Content');
    });

    it('can use toBeVisible matcher', () => {
      const TestComponent = () => <button>Click me</button>;
      renderWithProviders(<TestComponent />);
      expect(screen.getByRole('button')).toBeVisible();
    });
  });

  describe('Mock Imports', () => {
    it('can import and use mock factories', () => {
      const user = createMockUser({ firstName: 'John' });
      expect(user.firstName).toBe('John');
      expect(user.email).toContain('@example.com');
    });

    it('can create multiple mock users', () => {
      const user1 = createMockUser();
      const user2 = createMockUser();
      expect(user1.id).not.toBe(user2.id);
    });

    it('can create mock connections', () => {
      const connection = createMockConnection({ name: 'Jane Doe' });
      expect(connection.name).toBe('Jane Doe');
      expect(connection.profileId).toBeDefined();
    });
  });

  describe('Vitest Mock Functions', () => {
    it('can create and use vi.fn()', () => {
      const mockFn = vi.fn();
      mockFn('test');
      expect(mockFn).toHaveBeenCalledWith('test');
    });

    it('can mock return values', () => {
      const mockFn = vi.fn().mockReturnValue('mocked');
      expect(mockFn()).toBe('mocked');
    });

    it('can mock resolved values', async () => {
      const mockFn = vi.fn().mockResolvedValue('async mocked');
      const result = await mockFn();
      expect(result).toBe('async mocked');
    });
  });

  describe('React Rendering', () => {
    it('renders a simple component with providers', () => {
      const TestComponent = () => (
        <div>
          <h1>Test Heading</h1>
          <p>Test paragraph</p>
        </div>
      );

      renderWithProviders(<TestComponent />);

      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Test Heading');
      expect(screen.getByText('Test paragraph')).toBeInTheDocument();
    });

    it('renders with custom router props', () => {
      const TestComponent = () => <div>Route Content</div>;

      renderWithProviders(<TestComponent />, {
        routerProps: { initialEntries: ['/custom-path'] },
      });

      expect(screen.getByText('Route Content')).toBeInTheDocument();
    });
  });

  describe('Browser API Mocks', () => {
    it('localStorage mock works', () => {
      localStorage.setItem('test-key', 'test-value');
      expect(localStorage.getItem('test-key')).toBe('test-value');
      localStorage.removeItem('test-key');
      expect(localStorage.getItem('test-key')).toBeNull();
    });

    it('sessionStorage mock works', () => {
      sessionStorage.setItem('session-key', 'session-value');
      expect(sessionStorage.getItem('session-key')).toBe('session-value');
      sessionStorage.clear();
    });

    it('matchMedia mock works', () => {
      const mediaQuery = window.matchMedia('(min-width: 768px)');
      expect(mediaQuery.matches).toBe(false);
      expect(mediaQuery.media).toBe('(min-width: 768px)');
    });
  });
});
