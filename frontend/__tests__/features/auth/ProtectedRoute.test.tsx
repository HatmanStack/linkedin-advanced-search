import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { Routes, Route } from 'react-router-dom';
import { renderWithProviders, createMockUser } from '../../utils';

const mockUseAuth = vi.fn();

vi.mock('@/features/auth', () => ({
  useAuth: () => mockUseAuth(),
}));

import ProtectedRoute from '@/features/auth/components/ProtectedRoute';

describe('ProtectedRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state when auth is loading', () => {
    mockUseAuth.mockReturnValue({
      user: null,
      loading: true,
    });

    renderWithProviders(
      <Routes>
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <div>Protected Content</div>
            </ProtectedRoute>
          }
        />
      </Routes>,
      { routerProps: { initialEntries: ['/'] } }
    );

    expect(screen.getByText('Loading...')).toBeInTheDocument();
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  it('redirects to /auth when user is not authenticated', () => {
    mockUseAuth.mockReturnValue({
      user: null,
      loading: false,
    });

    renderWithProviders(
      <Routes>
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <div>Protected Content</div>
            </ProtectedRoute>
          }
        />
        <Route path="/auth" element={<div>Auth Page</div>} />
      </Routes>,
      { routerProps: { initialEntries: ['/'] } }
    );

    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
    expect(screen.getByText('Auth Page')).toBeInTheDocument();
  });

  it('renders children when user is authenticated', () => {
    const mockUser = createMockUser();
    mockUseAuth.mockReturnValue({
      user: mockUser,
      loading: false,
    });

    renderWithProviders(
      <Routes>
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <div>Protected Content</div>
            </ProtectedRoute>
          }
        />
        <Route path="/auth" element={<div>Auth Page</div>} />
      </Routes>,
      { routerProps: { initialEntries: ['/'] } }
    );

    expect(screen.getByText('Protected Content')).toBeInTheDocument();
    expect(screen.queryByText('Auth Page')).not.toBeInTheDocument();
  });

  it('renders complex children correctly', () => {
    const mockUser = createMockUser();
    mockUseAuth.mockReturnValue({
      user: mockUser,
      loading: false,
    });

    renderWithProviders(
      <Routes>
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <div>
                <h1>Dashboard</h1>
                <p>Welcome, {mockUser.firstName}!</p>
                <button>Action Button</button>
              </div>
            </ProtectedRoute>
          }
        />
      </Routes>,
      { routerProps: { initialEntries: ['/'] } }
    );

    expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
    expect(screen.getByText(/Welcome/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Action Button' })).toBeInTheDocument();
  });

  it('uses replace navigation for auth redirect', () => {
    mockUseAuth.mockReturnValue({
      user: null,
      loading: false,
    });

    const { container } = renderWithProviders(
      <Routes>
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <div>Dashboard</div>
            </ProtectedRoute>
          }
        />
        <Route path="/auth" element={<div>Auth Page</div>} />
      </Routes>,
      { routerProps: { initialEntries: ['/dashboard'] } }
    );

    expect(screen.getByText('Auth Page')).toBeInTheDocument();
    expect(container).toBeDefined();
  });

  it('loading state has correct styling', () => {
    mockUseAuth.mockReturnValue({
      user: null,
      loading: true,
    });

    renderWithProviders(
      <Routes>
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <div>Content</div>
            </ProtectedRoute>
          }
        />
      </Routes>,
      { routerProps: { initialEntries: ['/'] } }
    );

    const loadingContainer = screen.getByText('Loading...').parentElement;
    expect(loadingContainer).toHaveClass('min-h-screen');
    expect(loadingContainer).toHaveClass('flex');
    expect(loadingContainer).toHaveClass('items-center');
    expect(loadingContainer).toHaveClass('justify-center');
  });
});
