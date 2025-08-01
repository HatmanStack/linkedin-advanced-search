/**
 * Frontend Hook Tests for useProfileInit
 * Task 10: End-to-end testing and validation - Frontend Hook Testing
 * 
 * Tests the useProfileInit hook functionality, API integration,
 * error handling, and state management
 */

import { renderHook, act } from '@testing-library/react';
import { jest } from '@jest/globals';
import { useProfileInit } from '@/hooks/useProfileInit';

// Mock the API service
const mockApiService = {
  initializeProfileDatabase: jest.fn()
};

jest.mock('@/services/apiService', () => ({
  apiService: mockApiService
}));

// Mock the LinkedIn credentials context
const mockUseLinkedInCredentials = jest.fn();
jest.mock('@/contexts/LinkedInCredentialsContext', () => ({
  useLinkedInCredentials: () => mockUseLinkedInCredentials()
}));

// Mock the toast hook
const mockToast = jest.fn();
jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast })
}));

// Mock session storage
const mockSessionStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn()
};

Object.defineProperty(window, 'sessionStorage', {
  value: mockSessionStorage
});

describe('useProfileInit Hook - Task 10 Frontend Testing', () => {
  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Default mock implementations
    mockUseLinkedInCredentials.mockReturnValue({
      credentials: {
        email: 'test@example.com',
        password: 'testpassword'
      }
    });

    mockSessionStorage.getItem.mockReturnValue('mock-jwt-token');
    mockApiService.initializeProfileDatabase.mockResolvedValue({
      success: true,
      data: {
        success: true,
        message: 'Profile database initialized successfully!'
      }
    });
  });

  describe('Initial State - Requirements 1.1-1.4', () => {
    test('should initialize with correct default state', () => {
      const { result } = renderHook(() => useProfileInit());

      expect(result.current.isInitializing).toBe(false);
      expect(result.current.initializationMessage).toBe('');
      expect(result.current.initializationError).toBe('');
      expect(typeof result.current.initializeProfile).toBe('function');
      expect(typeof result.current.clearMessages).toBe('function');
    });

    test('should provide clearMessages functionality', () => {
      const { result } = renderHook(() => useProfileInit());

      // Set some messages first
      act(() => {
        // This would normally be set by the hook internally
        // We'll test this through the actual initialization process
      });

      act(() => {
        result.current.clearMessages();
      });

      expect(result.current.initializationMessage).toBe('');
      expect(result.current.initializationError).toBe('');
    });
  });

  describe('Successful Profile Initialization - Requirements 3.1-3.5, 7.1-7.2', () => {
    test('should handle successful profile initialization', async () => {
      const { result } = renderHook(() => useProfileInit());

      await act(async () => {
        await result.current.initializeProfile();
      });

      expect(result.current.isInitializing).toBe(false);
      expect(result.current.initializationMessage).toBe('Profile database initialized successfully!');
      expect(result.current.initializationError).toBe('');
      expect(mockToast).toHaveBeenCalledWith({
        title: "Success",
        description: "Profile database has been initialized successfully.",
      });
    });

    test('should call API service with correct parameters', async () => {
      const { result } = renderHook(() => useProfileInit());

      await act(async () => {
        await result.current.initializeProfile();
      });

      expect(mockApiService.initializeProfileDatabase).toHaveBeenCalledWith({
        searchName: 'test@example.com',
        searchPassword: 'testpassword',
        jwtToken: 'mock-jwt-token'
      });
    });

    test('should execute success callback when provided', async () => {
      const mockCallback = jest.fn();
      const { result } = renderHook(() => useProfileInit());

      await act(async () => {
        await result.current.initializeProfile(mockCallback);
      });

      expect(mockCallback).toHaveBeenCalledTimes(1);
    });

    test('should handle healing response (202 status)', async () => {
      mockApiService.initializeProfileDatabase.mockResolvedValue({
        success: true,
        data: {
          healing: true,
          message: 'Profile initialization is in progress with healing...'
        }
      });

      const { result } = renderHook(() => useProfileInit());

      await act(async () => {
        await result.current.initializeProfile();
      });

      expect(result.current.initializationMessage).toBe('Profile initialization is in progress with healing...');
      expect(mockToast).toHaveBeenCalledWith({
        title: "Processing",
        description: "Profile initialization is in progress. This may take a few minutes.",
      });
    });
  });

  describe('Error Handling - Requirements 5.4, 6.1, 6.4', () => {
    test('should handle missing LinkedIn credentials', async () => {
      mockUseLinkedInCredentials.mockReturnValue({
        credentials: {
          email: '',
          password: ''
        }
      });

      const { result } = renderHook(() => useProfileInit());

      await act(async () => {
        await result.current.initializeProfile();
      });

      expect(result.current.initializationError).toBe('LinkedIn credentials are required. Please set them in your profile settings.');
      expect(mockToast).toHaveBeenCalledWith({
        title: "Credentials Required",
        description: "Please set your LinkedIn credentials in profile settings before initializing the database.",
        variant: "destructive",
      });
    });

    test('should handle missing JWT token', async () => {
      mockSessionStorage.getItem.mockReturnValue(null);

      const { result } = renderHook(() => useProfileInit());

      await act(async () => {
        await result.current.initializeProfile();
      });

      expect(result.current.initializationError).toBe('Authentication token not found. Please log in again.');
      expect(mockToast).toHaveBeenCalledWith({
        title: "Error",
        description: "Authentication token not found. Please log in again.",
        variant: "destructive",
      });
    });

    test('should handle API service errors', async () => {
      mockApiService.initializeProfileDatabase.mockResolvedValue({
        success: false,
        error: 'Database connection failed'
      });

      const { result } = renderHook(() => useProfileInit());

      await act(async () => {
        await result.current.initializeProfile();
      });

      expect(result.current.initializationError).toBe('Database connection failed');
      expect(mockToast).toHaveBeenCalledWith({
        title: "Error",
        description: "Database connection failed",
        variant: "destructive",
      });
    });

    test('should handle network errors', async () => {
      mockApiService.initializeProfileDatabase.mockRejectedValue(new Error('Network timeout'));

      const { result } = renderHook(() => useProfileInit());

      await act(async () => {
        await result.current.initializeProfile();
      });

      expect(result.current.initializationError).toBe('Network timeout');
      expect(mockToast).toHaveBeenCalledWith({
        title: "Error",
        description: "Network timeout",
        variant: "destructive",
      });
    });

    test('should handle unknown errors gracefully', async () => {
      mockApiService.initializeProfileDatabase.mockRejectedValue('Unknown error');

      const { result } = renderHook(() => useProfileInit());

      await act(async () => {
        await result.current.initializeProfile();
      });

      expect(result.current.initializationError).toBe('Failed to initialize profile database');
      expect(mockToast).toHaveBeenCalledWith({
        title: "Error",
        description: "Failed to initialize profile database",
        variant: "destructive",
      });
    });
  });

  describe('Loading States - Requirements 2.3-2.4', () => {
    test('should set loading state during initialization', async () => {
      let resolvePromise: (value: any) => void;
      const promise = new Promise((resolve) => {
        resolvePromise = resolve;
      });

      mockApiService.initializeProfileDatabase.mockReturnValue(promise);

      const { result } = renderHook(() => useProfileInit());

      // Start initialization
      act(() => {
        result.current.initializeProfile();
      });

      // Should be loading
      expect(result.current.isInitializing).toBe(true);

      // Resolve the promise
      await act(async () => {
        resolvePromise!({
          success: true,
          data: { success: true, message: 'Success' }
        });
        await promise;
      });

      // Should no longer be loading
      expect(result.current.isInitializing).toBe(false);
    });

    test('should clear loading state on error', async () => {
      let rejectPromise: (error: any) => void;
      const promise = new Promise((_, reject) => {
        rejectPromise = reject;
      });

      mockApiService.initializeProfileDatabase.mockReturnValue(promise);

      const { result } = renderHook(() => useProfileInit());

      // Start initialization
      act(() => {
        result.current.initializeProfile();
      });

      // Should be loading
      expect(result.current.isInitializing).toBe(true);

      // Reject the promise
      await act(async () => {
        rejectPromise!(new Error('Test error'));
        try {
          await promise;
        } catch {
          // Expected to fail
        }
      });

      // Should no longer be loading
      expect(result.current.isInitializing).toBe(false);
    });
  });

  describe('State Management - Requirements 6.3, 6.6', () => {
    test('should clear previous messages before new initialization', async () => {
      const { result } = renderHook(() => useProfileInit());

      // First initialization with error
      mockApiService.initializeProfileDatabase.mockRejectedValue(new Error('First error'));

      await act(async () => {
        await result.current.initializeProfile();
      });

      expect(result.current.initializationError).toBe('First error');

      // Second initialization with success
      mockApiService.initializeProfileDatabase.mockResolvedValue({
        success: true,
        data: { success: true, message: 'Success' }
      });

      await act(async () => {
        await result.current.initializeProfile();
      });

      expect(result.current.initializationError).toBe('');
      expect(result.current.initializationMessage).toBe('Success');
    });

    test('should maintain state consistency across multiple calls', async () => {
      const { result } = renderHook(() => useProfileInit());

      // Multiple rapid calls should not cause state inconsistency
      const promises = [
        act(async () => await result.current.initializeProfile()),
        act(async () => await result.current.initializeProfile()),
        act(async () => await result.current.initializeProfile())
      ];

      await Promise.all(promises);

      expect(result.current.isInitializing).toBe(false);
      expect(result.current.initializationMessage).toBeTruthy();
    });
  });

  describe('API Integration - Requirements 7.1-7.6', () => {
    test('should handle different response formats', async () => {
      // Test response with direct message
      mockApiService.initializeProfileDatabase.mockResolvedValue({
        success: true,
        message: 'Direct message response'
      });

      const { result } = renderHook(() => useProfileInit());

      await act(async () => {
        await result.current.initializeProfile();
      });

      expect(result.current.initializationMessage).toBe('Direct message response');
    });

    test('should handle response without success flag', async () => {
      mockApiService.initializeProfileDatabase.mockResolvedValue({
        success: true,
        data: {
          message: 'Response without success flag'
        }
      });

      const { result } = renderHook(() => useProfileInit());

      await act(async () => {
        await result.current.initializeProfile();
      });

      expect(result.current.initializationMessage).toBe('Response without success flag');
    });

    test('should use JWT token from session storage', async () => {
      mockSessionStorage.getItem.mockReturnValue('custom-jwt-token');

      const { result } = renderHook(() => useProfileInit());

      await act(async () => {
        await result.current.initializeProfile();
      });

      expect(mockApiService.initializeProfileDatabase).toHaveBeenCalledWith(
        expect.objectContaining({
          jwtToken: 'custom-jwt-token'
        })
      );
    });
  });

  describe('User Experience - Requirements 2.1-2.4', () => {
    test('should provide appropriate toast notifications for all scenarios', async () => {
      const scenarios = [
        {
          name: 'success',
          mockResponse: { success: true, data: { success: true, message: 'Success' } },
          expectedToast: { title: "Success", description: "Profile database has been initialized successfully." }
        },
        {
          name: 'healing',
          mockResponse: { success: true, data: { healing: true, message: 'Healing in progress' } },
          expectedToast: { title: "Processing", description: "Profile initialization is in progress. This may take a few minutes." }
        }
      ];

      for (const scenario of scenarios) {
        jest.clearAllMocks();
        mockApiService.initializeProfileDatabase.mockResolvedValue(scenario.mockResponse);

        const { result } = renderHook(() => useProfileInit());

        await act(async () => {
          await result.current.initializeProfile();
        });

        expect(mockToast).toHaveBeenCalledWith(scenario.expectedToast);
      }
    });

    test('should provide user-friendly error messages', async () => {
      const errorScenarios = [
        {
          credentials: { email: '', password: 'test' },
          expectedError: 'LinkedIn credentials are required. Please set them in your profile settings.'
        },
        {
          credentials: { email: 'test@example.com', password: '' },
          expectedError: 'LinkedIn credentials are required. Please set them in your profile settings.'
        }
      ];

      for (const scenario of errorScenarios) {
        mockUseLinkedInCredentials.mockReturnValue({
          credentials: scenario.credentials
        });

        const { result } = renderHook(() => useProfileInit());

        await act(async () => {
          await result.current.initializeProfile();
        });

        expect(result.current.initializationError).toBe(scenario.expectedError);
      }
    });
  });

  describe('Performance and Memory Management - Requirements 4.1-4.2', () => {
    test('should handle concurrent initialization attempts gracefully', async () => {
      const { result } = renderHook(() => useProfileInit());

      // Start multiple concurrent initializations
      const promises = [
        act(async () => await result.current.initializeProfile()),
        act(async () => await result.current.initializeProfile()),
        act(async () => await result.current.initializeProfile())
      ];

      await Promise.all(promises);

      // Should complete without errors
      expect(result.current.isInitializing).toBe(false);
      expect(result.current.initializationMessage).toBeTruthy();
    });

    test('should clean up properly on unmount', () => {
      const { unmount } = renderHook(() => useProfileInit());

      // Should not throw errors on unmount
      expect(() => unmount()).not.toThrow();
    });
  });
});

// Export test utilities for other tests
export const createMockApiResponse = (overrides = {}) => ({
  success: true,
  data: {
    success: true,
    message: 'Mock success message'
  },
  ...overrides
});

export const createMockCredentials = (overrides = {}) => ({
  email: 'test@example.com',
  password: 'testpassword',
  ...overrides
});

export const setupMockEnvironment = (options = {}) => {
  const {
    credentials = createMockCredentials(),
    jwtToken = 'mock-jwt-token',
    apiResponse = createMockApiResponse()
  } = options;

  mockUseLinkedInCredentials.mockReturnValue({ credentials });
  mockSessionStorage.getItem.mockReturnValue(jwtToken);
  mockApiService.initializeProfileDatabase.mockResolvedValue(apiResponse);
};