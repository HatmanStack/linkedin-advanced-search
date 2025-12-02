import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../utils';

const mockNavigate = vi.fn();
const mockSignIn = vi.fn();
const mockSignUp = vi.fn();
const mockConfirmSignUp = vi.fn();
const mockResendConfirmationCode = vi.fn();
const mockToast = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('@/features/auth', () => ({
  useAuth: () => ({
    signIn: mockSignIn,
    signUp: mockSignUp,
    confirmSignUp: mockConfirmSignUp,
    resendConfirmationCode: mockResendConfirmationCode,
  }),
}));

vi.mock('@/shared/hooks', () => ({
  useToast: () => ({
    toast: mockToast,
  }),
}));

let mockIsCognitoConfigured = false;
vi.mock('@/config/appConfig', () => ({
  get isCognitoConfigured() {
    return mockIsCognitoConfigured;
  },
}));

import Auth from '@/pages/Auth';

describe('Auth Page Integration Tests', () => {
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
    mockIsCognitoConfigured = false;
    mockSignIn.mockResolvedValue({ error: null });
    mockSignUp.mockResolvedValue({ error: null });
    mockConfirmSignUp.mockResolvedValue({ error: null });
    mockResendConfirmationCode.mockResolvedValue({ error: null });
  });

  describe('Sign In Flow', () => {
    it('renders sign in form by default', () => {
      renderWithProviders(<Auth />);
      expect(screen.getByRole('tab', { name: 'Sign In' })).toHaveAttribute('data-state', 'active');
      expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    });

    it('allows user to enter email and password', async () => {
      renderWithProviders(<Auth />);

      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/password/i);

      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'password123');

      expect(emailInput).toHaveValue('test@example.com');
      expect(passwordInput).toHaveValue('password123');
    });

    it('submits sign in form and navigates on success', async () => {
      mockSignIn.mockResolvedValue({ error: null });
      renderWithProviders(<Auth />);

      await user.type(screen.getByLabelText(/email/i), 'test@example.com');
      await user.type(screen.getByLabelText(/password/i), 'password123');
      await user.click(screen.getByRole('button', { name: /sign in/i }));

      await waitFor(() => {
        expect(mockSignIn).toHaveBeenCalledWith('test@example.com', 'password123');
      });

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Welcome back!',
          })
        );
      });

      expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
    });

    it('shows error toast on sign in failure', async () => {
      mockSignIn.mockResolvedValue({
        error: { message: 'Invalid credentials' },
      });

      renderWithProviders(<Auth />);

      await user.type(screen.getByLabelText(/email/i), 'test@example.com');
      await user.type(screen.getByLabelText(/password/i), 'wrongpassword');
      await user.click(screen.getByRole('button', { name: /sign in/i }));

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Sign In Failed',
            variant: 'destructive',
          })
        );
      });

      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it('toggles password visibility', async () => {
      renderWithProviders(<Auth />);

      const passwordInput = screen.getByLabelText(/password/i);
      expect(passwordInput).toHaveAttribute('type', 'password');

      const passwordContainer = passwordInput.parentElement;
      const toggleButton = passwordContainer?.querySelector('button');

      if (toggleButton) {
        await user.click(toggleButton);
        expect(passwordInput).toHaveAttribute('type', 'text');

        await user.click(toggleButton);
        expect(passwordInput).toHaveAttribute('type', 'password');
      }
    });
  });

  describe('Sign Up Flow', () => {
    it('can switch to sign up tab', async () => {
      renderWithProviders(<Auth />);

      await user.click(screen.getByRole('tab', { name: 'Sign Up' }));

      expect(screen.getByRole('tab', { name: 'Sign Up' })).toHaveAttribute('data-state', 'active');
      expect(screen.getByLabelText(/first name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/last name/i)).toBeInTheDocument();
    });

    it('submits sign up form in mock mode', async () => {
      mockIsCognitoConfigured = false;
      mockSignUp.mockResolvedValue({ error: null });

      renderWithProviders(<Auth />);

      await user.click(screen.getByRole('tab', { name: 'Sign Up' }));

      await user.type(screen.getByLabelText(/first name/i), 'John');
      await user.type(screen.getByLabelText(/last name/i), 'Doe');
      await user.type(screen.getByLabelText(/email/i), 'john@example.com');
      await user.type(screen.getByLabelText(/password/i), 'password123');

      await user.click(screen.getByRole('button', { name: /create account/i }));

      await waitFor(() => {
        expect(mockSignUp).toHaveBeenCalledWith(
          'john@example.com',
          'password123',
          'John',
          'Doe'
        );
      });

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
      });
    });

    it('shows verification view when Cognito configured', async () => {
      mockIsCognitoConfigured = true;
      mockSignUp.mockResolvedValue({ error: null });

      renderWithProviders(<Auth />);

      await user.click(screen.getByRole('tab', { name: 'Sign Up' }));

      await user.type(screen.getByLabelText(/email/i), 'john@example.com');
      await user.type(screen.getByLabelText(/password/i), 'password123');

      await user.click(screen.getByRole('button', { name: /create account/i }));

      await waitFor(() => {
        expect(screen.getByText(/verify your email/i)).toBeInTheDocument();
      });

      expect(screen.getByText('john@example.com')).toBeInTheDocument();
    });

    it('shows error toast on sign up failure', async () => {
      mockSignUp.mockResolvedValue({
        error: { message: 'User already exists' },
      });

      renderWithProviders(<Auth />);

      await user.click(screen.getByRole('tab', { name: 'Sign Up' }));

      await user.type(screen.getByLabelText(/email/i), 'existing@example.com');
      await user.type(screen.getByLabelText(/password/i), 'password123');

      await user.click(screen.getByRole('button', { name: /create account/i }));

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Sign Up Failed',
            variant: 'destructive',
          })
        );
      });
    });
  });

  describe('Verification Flow', () => {
    it('can enter verification code and submit', async () => {
      mockIsCognitoConfigured = true;
      mockSignUp.mockResolvedValue({ error: null });
      mockConfirmSignUp.mockResolvedValue({ error: null });

      renderWithProviders(<Auth />);

      await user.click(screen.getByRole('tab', { name: 'Sign Up' }));
      await user.type(screen.getByLabelText(/email/i), 'john@example.com');
      await user.type(screen.getByLabelText(/password/i), 'password123');
      await user.click(screen.getByRole('button', { name: /create account/i }));

      await waitFor(() => {
        expect(screen.getByText(/verify your email/i)).toBeInTheDocument();
      });

      const codeInput = screen.getByLabelText(/verification code/i);
      await user.type(codeInput, '123456');

      await user.click(screen.getByRole('button', { name: /verify email/i }));

      await waitFor(() => {
        expect(mockConfirmSignUp).toHaveBeenCalledWith('john@example.com', '123456');
      });
    });

    it('can resend verification code', async () => {
      mockIsCognitoConfigured = true;
      mockSignUp.mockResolvedValue({ error: null });
      mockResendConfirmationCode.mockResolvedValue({ error: null });

      renderWithProviders(<Auth />);

      await user.click(screen.getByRole('tab', { name: 'Sign Up' }));
      await user.type(screen.getByLabelText(/email/i), 'john@example.com');
      await user.type(screen.getByLabelText(/password/i), 'password123');
      await user.click(screen.getByRole('button', { name: /create account/i }));

      await waitFor(() => {
        expect(screen.getByText(/verify your email/i)).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /resend code/i }));

      await waitFor(() => {
        expect(mockResendConfirmationCode).toHaveBeenCalledWith('john@example.com');
      });
    });

    it('can navigate back from verification view', async () => {
      mockIsCognitoConfigured = true;
      mockSignUp.mockResolvedValue({ error: null });

      renderWithProviders(<Auth />);

      await user.click(screen.getByRole('tab', { name: 'Sign Up' }));
      await user.type(screen.getByLabelText(/email/i), 'john@example.com');
      await user.type(screen.getByLabelText(/password/i), 'password123');
      await user.click(screen.getByRole('button', { name: /create account/i }));

      await waitFor(() => {
        expect(screen.getByText(/verify your email/i)).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /back/i }));

      await waitFor(() => {
        expect(screen.queryByText(/verify your email/i)).not.toBeInTheDocument();
        expect(screen.getByRole('tab', { name: 'Sign In' })).toBeInTheDocument();
      });
    });
  });

  describe('Demo Mode Banner', () => {
    it('shows demo mode banner when Cognito not configured', () => {
      mockIsCognitoConfigured = false;
      renderWithProviders(<Auth />);

      expect(screen.getByText(/demo mode/i)).toBeInTheDocument();
    });

    it('does not show demo mode banner when Cognito configured', () => {
      mockIsCognitoConfigured = true;
      renderWithProviders(<Auth />);

      expect(screen.queryByText(/demo mode/i)).not.toBeInTheDocument();
    });
  });

  describe('Navigation', () => {
    it('has back to home button', () => {
      renderWithProviders(<Auth />);

      expect(screen.getByRole('button', { name: /back to home/i })).toBeInTheDocument();
    });

    it('navigates to home when back button clicked', async () => {
      renderWithProviders(<Auth />);

      await user.click(screen.getByRole('button', { name: /back to home/i }));

      expect(mockNavigate).toHaveBeenCalledWith('/');
    });
  });
});
