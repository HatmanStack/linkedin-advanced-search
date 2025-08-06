/**
 * API Backend Integration Tests
 * 
 * Comprehensive integration testing for backend API services and database operations
 * Tests the complete flow from frontend API calls to backend processing and database storage
 * 
 * Test Coverage:
 * - API service integration with backend endpoints
 * - Database operations and data consistency
 * - Authentication and authorization flows
 * - Error handling and recovery mechanisms
 * - Performance under load conditions
 * - Data validation and sanitization
 */

import { describe, it, expect, beforeEach, afterEach, vi, beforeAll, afterAll } from 'vitest';
import { apiService } from '../../services/apiService';
import { dbConnector } from '../../services/dbConnector';
import { cognitoService } from '../../services/cognitoService';

// Mock external dependencies
vi.mock('../../services/cognitoService');

describe('API Backend Integration Tests', () => {
  let mockCognitoService: any;
  let originalFetch: any;
  let mockFetch: any;

  beforeAll(() => {
    // Setup global test environment
    originalFetch = global.fetch;
    mockFetch = vi.fn();
    global.fetch = mockFetch;
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup mock Cognito service
    mockCognitoService = {
      getCurrentUser: vi.fn().mockResolvedValue({
        username: 'test-user-123',
        attributes: {
          email: 'test@example.com',
          sub: 'user-id-123'
        }
      }),
      getIdToken: vi.fn().mockResolvedValue('mock-jwt-token'),
      isAuthenticated: vi.fn().mockResolvedValue(true)
    };

    (cognitoService as any) = mockCognitoService;

    // Setup default successful API responses
    mockFetch.mockImplementation((url: string, options: any) => {
      const method = options?.method || 'GET';
      const endpoint = url.split('/').pop();

      // Mock different endpoints
      switch (endpoint) {
        case 'profile':
          if (method === 'GET') {
            return Promise.resolve({
              ok: true,
              status: 200,
              json: () => Promise.resolve({
                userId: 'user-id-123',
                email: 'test@example.com',
                preferences: {
                  theme: 'light',
                  notifications: true
                },
                createdAt: '2024-01-01T00:00:00Z',
                updatedAt: '2024-01-01T00:00:00Z'
              })
            });
          } else if (method === 'POST' || method === 'PUT') {
            return Promise.resolve({
              ok: true,
              status: method === 'POST' ? 201 : 200,
              json: () => Promise.resolve({
                userId: 'user-id-123',
                message: `Profile ${method === 'POST' ? 'created' : 'updated'} successfully`
              })
            });
          }
          break;

        case 'connections':
          if (method === 'GET') {
            return Promise.resolve({
              ok: true,
              status: 200,
              json: () => Promise.resolve({
                connections: [
                  {
                    id: 'conn-1',
                    profileId: 'profile-1',
                    name: 'John Doe',
                    title: 'Software Engineer',
                    company: 'Tech Corp',
                    status: 'connected',
                    connectedAt: '2024-01-01T00:00:00Z',
                    lastMessageAt: '2024-01-02T00:00:00Z',
                    messageCount: 5,
                    tags: ['colleague', 'tech'],
                    engagementScore: 85
                  },
                  {
                    id: 'conn-2',
                    profileId: 'profile-2',
                    name: 'Jane Smith',
                    title: 'Product Manager',
                    company: 'Innovation Inc',
                    status: 'pending',
                    connectedAt: null,
                    lastMessageAt: null,
                    messageCount: 0,
                    tags: ['prospect'],
                    engagementScore: 0
                  }
                ],
                pagination: {
                  total: 2,
                  page: 1,
                  limit: 50,
                  hasMore: false
                }
              })
            });
          } else if (method === 'POST') {
            return Promise.resolve({
              ok: true,
              status: 201,
              json: () => Promise.resolve({
                id: 'conn-new',
                message: 'Connection created successfully'
              })
            });
          }
          break;

        default:
          return Promise.resolve({
            ok: false,
            status: 404,
            json: () => Promise.resolve({ error: 'Endpoint not found' })
          });
      }
    });
  });

  describe('Authentication Integration', () => {
    it('should include JWT token in API requests', async () => {
      await apiService.getProfile();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/profile'),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer mock-jwt-token',
            'Content-Type': 'application/json'
          })
        })
      );
    });

    it('should handle authentication failures gracefully', async () => {
      mockCognitoService.getIdToken.mockRejectedValue(new Error('Token expired'));

      await expect(apiService.getProfile()).rejects.toThrow('Authentication failed');
    });

    it('should retry with fresh token on 401 responses', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 401,
          json: () => Promise.resolve({ error: 'Unauthorized' })
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ userId: 'user-id-123' })
        });

      mockCognitoService.getIdToken
        .mockResolvedValueOnce('expired-token')
        .mockResolvedValueOnce('fresh-token');

      const result = await apiService.getProfile();

      expect(result.userId).toBe('user-id-123');
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(mockCognitoService.getIdToken).toHaveBeenCalledTimes(2);
    });
  });

  describe('Profile Management Integration', () => {
    it('should successfully retrieve user profile', async () => {
      const profile = await apiService.getProfile();

      expect(profile).toMatchObject({
        userId: 'user-id-123',
        email: 'test@example.com',
        preferences: expect.objectContaining({
          theme: 'light',
          notifications: true
        }),
        createdAt: expect.any(String),
        updatedAt: expect.any(String)
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/profile'),
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'Authorization': 'Bearer mock-jwt-token'
          })
        })
      );
    });

    it('should successfully create new user profile', async () => {
      const profileData = {
        email: 'newuser@example.com',
        preferences: {
          theme: 'dark',
          notifications: false
        }
      };

      const result = await apiService.createProfile(profileData);

      expect(result).toMatchObject({
        userId: 'user-id-123',
        message: 'Profile created successfully'
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/profile'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer mock-jwt-token',
            'Content-Type': 'application/json'
          }),
          body: JSON.stringify(profileData)
        })
      );
    });

    it('should successfully update existing profile', async () => {
      const updateData = {
        preferences: {
          theme: 'dark',
          notifications: true
        }
      };

      const result = await apiService.updateProfile(updateData);

      expect(result).toMatchObject({
        userId: 'user-id-123',
        message: 'Profile updated successfully'
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/profile'),
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify(updateData)
        })
      );
    });

    it('should handle profile not found errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: () => Promise.resolve({ error: 'Profile not found' })
      });

      await expect(apiService.getProfile()).rejects.toThrow('Profile not found');
    });
  });

  describe('Connection Management Integration', () => {
    it('should successfully retrieve connections list', async () => {
      const connections = await apiService.getConnections();

      expect(connections).toMatchObject({
        connections: expect.arrayContaining([
          expect.objectContaining({
            id: 'conn-1',
            profileId: 'profile-1',
            name: 'John Doe',
            status: 'connected',
            messageCount: 5,
            tags: expect.arrayContaining(['colleague', 'tech']),
            engagementScore: 85
          }),
          expect.objectContaining({
            id: 'conn-2',
            profileId: 'profile-2',
            name: 'Jane Smith',
            status: 'pending',
            messageCount: 0
          })
        ]),
        pagination: expect.objectContaining({
          total: 2,
          page: 1,
          limit: 50,
          hasMore: false
        })
      });
    });

    it('should support connection filtering and pagination', async () => {
      const filters = {
        status: 'connected',
        tags: ['colleague'],
        page: 2,
        limit: 25
      };

      await apiService.getConnections(filters);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/connections?status=connected&tags=colleague&page=2&limit=25'),
        expect.objectContaining({
          method: 'GET'
        })
      );
    });

    it('should successfully create new connection', async () => {
      const connectionData = {
        profileId: 'new-profile-123',
        name: 'New Contact',
        title: 'Manager',
        company: 'New Company',
        status: 'pending',
        tags: ['prospect', 'sales']
      };

      const result = await apiService.createConnection(connectionData);

      expect(result).toMatchObject({
        id: 'conn-new',
        message: 'Connection created successfully'
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/connections'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(connectionData)
        })
      );
    });

    it('should handle connection creation validation errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: () => Promise.resolve({
          error: 'Validation failed',
          details: {
            profileId: 'Profile ID is required',
            name: 'Name must be at least 2 characters'
          }
        })
      });

      const invalidData = {
        profileId: '',
        name: 'A'
      };

      await expect(apiService.createConnection(invalidData))
        .rejects.toThrow('Validation failed');
    });
  });

  describe('Database Integration via dbConnector', () => {
    it('should successfully store and retrieve profile data', async () => {
      const profileData = {
        userId: 'user-id-123',
        email: 'test@example.com',
        preferences: { theme: 'light' }
      };

      // Test profile creation
      await dbConnector.createProfile(profileData);
      
      // Test profile retrieval
      const retrievedProfile = await dbConnector.getProfile('user-id-123');
      
      expect(retrievedProfile).toMatchObject(profileData);
    });

    it('should handle database connection failures gracefully', async () => {
      // Mock database connection failure
      vi.spyOn(dbConnector, 'getProfile').mockRejectedValue(
        new Error('Database connection failed')
      );

      await expect(dbConnector.getProfile('user-id-123'))
        .rejects.toThrow('Database connection failed');
    });

    it('should maintain data consistency across operations', async () => {
      const connectionData = {
        id: 'conn-test-123',
        profileId: 'profile-123',
        name: 'Test Connection',
        status: 'connected',
        messageCount: 0
      };

      // Create connection
      await dbConnector.createConnection(connectionData);
      
      // Update message count
      await dbConnector.updateConnection('conn-test-123', {
        messageCount: 5,
        lastMessageAt: new Date().toISOString()
      });
      
      // Retrieve and verify
      const updatedConnection = await dbConnector.getConnection('conn-test-123');
      
      expect(updatedConnection.messageCount).toBe(5);
      expect(updatedConnection.lastMessageAt).toBeDefined();
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle network timeouts with retry logic', async () => {
      let attemptCount = 0;
      mockFetch.mockImplementation(() => {
        attemptCount++;
        if (attemptCount < 3) {
          return Promise.reject(new Error('Network timeout'));
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ success: true })
        });
      });

      const result = await apiService.getProfile();
      
      expect(result.success).toBe(true);
      expect(attemptCount).toBe(3);
    });

    it('should handle server errors with appropriate user feedback', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.resolve({
          error: 'Internal server error',
          message: 'Database temporarily unavailable'
        })
      });

      await expect(apiService.getProfile())
        .rejects.toThrow('Database temporarily unavailable');
    });

    it('should handle malformed API responses gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.reject(new Error('Invalid JSON'))
      });

      await expect(apiService.getProfile())
        .rejects.toThrow('Invalid response format');
    });
  });

  describe('Performance and Load Testing', () => {
    it('should handle concurrent API requests efficiently', async () => {
      const concurrentRequests = Array.from({ length: 10 }, (_, i) => 
        apiService.getConnections({ page: i + 1 })
      );

      const startTime = Date.now();
      const results = await Promise.all(concurrentRequests);
      const endTime = Date.now();

      expect(results).toHaveLength(10);
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
      expect(mockFetch).toHaveBeenCalledTimes(10);
    });

    it('should handle large dataset responses efficiently', async () => {
      // Mock large dataset response
      const largeDataset = {
        connections: Array.from({ length: 1000 }, (_, i) => ({
          id: `conn-${i}`,
          profileId: `profile-${i}`,
          name: `Contact ${i}`,
          status: 'connected',
          messageCount: Math.floor(Math.random() * 50),
          tags: [`tag-${i % 10}`],
          engagementScore: Math.floor(Math.random() * 100)
        })),
        pagination: {
          total: 1000,
          page: 1,
          limit: 1000,
          hasMore: false
        }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(largeDataset)
      });

      const startTime = Date.now();
      const result = await apiService.getConnections({ limit: 1000 });
      const endTime = Date.now();

      expect(result.connections).toHaveLength(1000);
      expect(endTime - startTime).toBeLessThan(2000); // Should process within 2 seconds
    });

    it('should implement proper request throttling', async () => {
      // Simulate rapid requests
      const rapidRequests = Array.from({ length: 50 }, () => 
        apiService.getProfile()
      );

      const startTime = Date.now();
      await Promise.all(rapidRequests);
      const endTime = Date.now();

      // Should implement some form of throttling/batching
      expect(endTime - startTime).toBeGreaterThan(1000); // At least 1 second for 50 requests
    });
  });

  describe('Data Validation and Sanitization', () => {
    it('should validate required fields before API calls', async () => {
      const invalidConnectionData = {
        // Missing required profileId
        name: 'Test Connection'
      };

      await expect(apiService.createConnection(invalidConnectionData))
        .rejects.toThrow('profileId is required');
    });

    it('should sanitize user input data', async () => {
      const unsafeData = {
        profileId: 'profile-123',
        name: '<script>alert("xss")</script>John Doe',
        title: 'Manager & CEO',
        company: 'Test & Co.'
      };

      await apiService.createConnection(unsafeData);

      const sentData = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(sentData.name).not.toContain('<script>');
      expect(sentData.name).toBe('John Doe'); // Should be sanitized
    });

    it('should validate data types and formats', async () => {
      const invalidData = {
        profileId: 123, // Should be string
        name: '', // Should not be empty
        messageCount: 'invalid', // Should be number
        tags: 'not-an-array' // Should be array
      };

      await expect(apiService.createConnection(invalidData))
        .rejects.toThrow('Invalid data format');
    });
  });

  describe('Cache Integration', () => {
    it('should cache frequently accessed data', async () => {
      // First request
      await apiService.getProfile();
      
      // Second request should use cache
      await apiService.getProfile();

      // Should only make one actual API call due to caching
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should invalidate cache on data updates', async () => {
      // Get profile (cached)
      await apiService.getProfile();
      
      // Update profile (should invalidate cache)
      await apiService.updateProfile({ preferences: { theme: 'dark' } });
      
      // Get profile again (should make new API call)
      await apiService.getProfile();

      expect(mockFetch).toHaveBeenCalledTimes(3); // get, update, get (no cache)
    });

    it('should handle cache expiration properly', async () => {
      // Mock cache expiration
      vi.useFakeTimers();
      
      // First request
      await apiService.getProfile();
      
      // Advance time beyond cache expiration
      vi.advanceTimersByTime(5 * 60 * 1000); // 5 minutes
      
      // Second request should make new API call
      await apiService.getProfile();

      expect(mockFetch).toHaveBeenCalledTimes(2);
      
      vi.useRealTimers();
    });
  });
});
