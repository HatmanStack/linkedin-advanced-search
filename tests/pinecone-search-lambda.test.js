/**
 * Comprehensive Test Suite for Pinecone Search Lambda Function
 * 
 * Tests all key aspects of the Lambda's logic including:
 * - JWT token validation and user extraction
 * - Query preprocessing and optimization
 * - User connection filtering
 * - Pinecone search functionality
 * - Error handling and edge cases
 * - Response formatting
 * 
 * Usage:
 *   npx jest test-pinecone-search-lambda.js
 */

// Note: This file uses CommonJS to match the Lambda function's module system

const jwt = require('jsonwebtoken');

// Mock AWS SDK
const mockDynamoDBQuery = jest.fn();
const mockBedrockInvokeModel = jest.fn();

// Mock Pinecone
const mockPineconeSearchRecords = jest.fn();
const mockPineconeRerank = jest.fn();

// Mock dependencies
jest.mock('aws-sdk', () => ({
    DynamoDB: {
        DocumentClient: jest.fn(() => ({
            query: mockDynamoDBQuery
        }))
    },
    BedrockRuntime: jest.fn(() => ({
        invokeModel: mockBedrockInvokeModel
    }))
}));

jest.mock('@pinecone-database/pinecone', () => ({
    Pinecone: jest.fn(() => ({
        Index: jest.fn(() => ({
            searchRecords: mockPineconeSearchRecords,
            rerank: mockPineconeRerank
        }))
    }))
}));

// Set environment variables for testing
process.env.PINECONE_INDEX_NAME = 'test-linkedin-profiles';
process.env.PINECONE_HOST = 'test-host.pinecone.io';
process.env.PINECONE_API_KEY = 'test-api-key';
process.env.DYNAMODB_TABLE = 'test-linkedin-advanced-search';
process.env.AWS_REGION = 'us-west-2';
process.env.COGNITO_USER_POOL_ID = 'test-pool-id';
process.env.NODE_ENV = 'test';

// Import the Lambda function after mocking
const { handler } = require('../lambda-processing/pinecone-search/index.js');

describe('Pinecone Search Lambda Function', () => {

    beforeEach(() => {
        // Reset all mocks before each test
        jest.clearAllMocks();

        // Default mock implementations
        mockDynamoDBQuery.mockReturnValue({
            promise: () => Promise.resolve({
                Items: [
                    { SK: 'PROFILE#john-doe-123' },
                    { SK: 'PROFILE#jane-smith-456' },
                    { SK: 'PROFILE#bob-johnson-789' }
                ]
            })
        });

        mockBedrockInvokeModel.mockReturnValue({
            promise: () => Promise.resolve({
                body: Buffer.from(JSON.stringify({
                    content: [{ text: 'optimized search query' }]
                }))
            })
        });

        mockPineconeSearchRecords.mockResolvedValue({
            matches: [
                {
                    id: 'john-doe-123',
                    score: 0.95,
                    metadata: {
                        profile_id: 'john-doe-123',
                        name: 'John Doe',
                        title: 'Senior Software Engineer',
                        company: 'TechCorp',
                        location: 'San Francisco, CA',
                        summary: 'Experienced software engineer...',
                        skills: ['JavaScript', 'Python', 'AWS'],
                        headline: 'Senior Software Engineer at TechCorp'
                    }
                }
            ]
        });

        mockPineconeRerank.mockResolvedValue({
            matches: [
                {
                    id: 'john-doe-123',
                    score: 0.98,
                    metadata: {
                        profile_id: 'john-doe-123',
                        name: 'John Doe',
                        title: 'Senior Software Engineer',
                        company: 'TechCorp',
                        location: 'San Francisco, CA',
                        summary: 'Experienced software engineer...',
                        skills: ['JavaScript', 'Python', 'AWS'],
                        headline: 'Senior Software Engineer at TechCorp'
                    }
                }
            ]
        });
    });

    describe('CORS Preflight Handling', () => {
        test('should handle OPTIONS request correctly', async () => {
            const event = {
                httpMethod: 'OPTIONS',
                headers: {},
                body: null
            };

            const result = await handler(event);

            expect(result.statusCode).toBe(200);
            expect(result.headers['Access-Control-Allow-Origin']).toBe('*');
            expect(result.headers['Access-Control-Allow-Headers']).toBe('Content-Type,Authorization');
            expect(result.headers['Access-Control-Allow-Methods']).toBe('POST,OPTIONS');
            expect(result.body).toBe('');
        });
    });

    describe('JWT Token Validation', () => {
        test('should extract user ID from valid JWT token', async () => {
            const mockToken = jwt.sign({ sub: 'test-user-123' }, 'secret');

            const event = {
                httpMethod: 'POST',
                headers: {
                    Authorization: `Bearer ${mockToken}`
                },
                body: JSON.stringify({
                    query: 'software engineer'
                })
            };

            const result = await handler(event);

            expect(result.statusCode).toBe(200);
            expect(mockDynamoDBQuery).toHaveBeenCalledWith(
                expect.objectContaining({
                    ExpressionAttributeValues: expect.objectContaining({
                        ':pk': 'USER#test-user-123'
                    })
                })
            );
        });

        test('should return 401 for missing Authorization header', async () => {
            const event = {
                httpMethod: 'POST',
                headers: {},
                body: JSON.stringify({
                    query: 'software engineer'
                })
            };

            const result = await handler(event);

            expect(result.statusCode).toBe(401);
            expect(JSON.parse(result.body).error).toBe('Unauthorized');
        });

        test('should return 401 for invalid Authorization header format', async () => {
            const event = {
                httpMethod: 'POST',
                headers: {
                    Authorization: 'InvalidFormat token'
                },
                body: JSON.stringify({
                    query: 'software engineer'
                })
            };

            const result = await handler(event);

            expect(result.statusCode).toBe(401);
            expect(JSON.parse(result.body).error).toBe('Unauthorized');
        });

        test('should return 401 for malformed JWT token', async () => {
            const event = {
                httpMethod: 'POST',
                headers: {
                    Authorization: 'Bearer invalid.jwt.token'
                },
                body: JSON.stringify({
                    query: 'software engineer'
                })
            };

            const result = await handler(event);

            expect(result.statusCode).toBe(401);
            expect(JSON.parse(result.body).error).toBe('Unauthorized');
        });
    });

    describe('Request Validation', () => {
        const validToken = jwt.sign({ sub: 'test-user-123' }, 'secret');

        test('should return 400 for invalid JSON body', async () => {
            const event = {
                httpMethod: 'POST',
                headers: {
                    Authorization: `Bearer ${validToken}`
                },
                body: 'invalid json'
            };

            const result = await handler(event);

            expect(result.statusCode).toBe(400);
            expect(JSON.parse(result.body).error).toBe('Bad request');
        });

        test('should return 500 for missing query parameter', async () => {
            const event = {
                httpMethod: 'POST',
                headers: {
                    Authorization: `Bearer ${validToken}`
                },
                body: JSON.stringify({})
            };

            const result = await handler(event);

            expect(result.statusCode).toBe(500);
            expect(JSON.parse(result.body).error).toBe('Internal server error');
        });

        test('should return 500 for empty query string', async () => {
            const event = {
                httpMethod: 'POST',
                headers: {
                    Authorization: `Bearer ${validToken}`
                },
                body: JSON.stringify({
                    query: '   '
                })
            };

            const result = await handler(event);

            expect(result.statusCode).toBe(500);
            expect(JSON.parse(result.body).error).toBe('Internal server error');
        });

        test('should return 500 for limit exceeding maximum', async () => {
            const event = {
                httpMethod: 'POST',
                headers: {
                    Authorization: `Bearer ${validToken}`
                },
                body: JSON.stringify({
                    query: 'software engineer',
                    limit: 100
                })
            };

            const result = await handler(event);

            expect(result.statusCode).toBe(500);
            expect(JSON.parse(result.body).error).toBe('Internal server error');
        });
    });

    describe('User Connection Filtering', () => {
        const validToken = jwt.sign({ sub: 'test-user-123' }, 'secret');

        test('should fetch user connected profiles from DynamoDB', async () => {
            const event = {
                httpMethod: 'POST',
                headers: {
                    Authorization: `Bearer ${validToken}`
                },
                body: JSON.stringify({
                    query: 'software engineer'
                })
            };

            await handler(event);

            expect(mockDynamoDBQuery).toHaveBeenCalledWith({
                TableName: 'test-linkedin-advanced-search',
                KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
                ExpressionAttributeValues: {
                    ':pk': 'USER#test-user-123',
                    ':sk': 'PROFILE#'
                },
                ProjectionExpression: 'SK'
            });
        });

        test('should return empty results when user has no connections', async () => {
            mockDynamoDBQuery.mockReturnValue({
                promise: () => Promise.resolve({ Items: [] })
            });

            const event = {
                httpMethod: 'POST',
                headers: {
                    Authorization: `Bearer ${validToken}`
                },
                body: JSON.stringify({
                    query: 'software engineer'
                })
            };

            const result = await handler(event);

            expect(result.statusCode).toBe(200);
            const responseBody = JSON.parse(result.body);
            expect(responseBody.results).toEqual([]);
            expect(responseBody.total).toBe(0);
            expect(mockPineconeSearchRecords).not.toHaveBeenCalled();
        });

        test('should handle DynamoDB query errors', async () => {
            mockDynamoDBQuery.mockReturnValue({
                promise: () => Promise.reject(new Error('DynamoDB error'))
            });

            const event = {
                httpMethod: 'POST',
                headers: {
                    Authorization: `Bearer ${validToken}`
                },
                body: JSON.stringify({
                    query: 'software engineer'
                })
            };

            const result = await handler(event);

            expect(result.statusCode).toBe(500);
            expect(JSON.parse(result.body).error).toBe('Internal server error');
        });
    });

    describe('Query Optimization', () => {
        const validToken = jwt.sign({ sub: 'test-user-123' }, 'secret');

        test('should optimize query using AWS Nova', async () => {
            const event = {
                httpMethod: 'POST',
                headers: {
                    Authorization: `Bearer ${validToken}`
                },
                body: JSON.stringify({
                    query: 'AI engineer'
                })
            };

            await handler(event);

            expect(mockBedrockInvokeModel).toHaveBeenCalledWith(
                expect.objectContaining({
                    modelId: 'amazon.nova-micro-v1:0',
                    body: expect.stringContaining('ai engineer'), // Lambda converts to lowercase
                    contentType: 'application/json'
                })
            );
        });

        test('should fallback to original query when optimization fails', async () => {
            mockBedrockInvokeModel.mockReturnValue({
                promise: () => Promise.reject(new Error('Bedrock error'))
            });

            const event = {
                httpMethod: 'POST',
                headers: {
                    Authorization: `Bearer ${validToken}`
                },
                body: JSON.stringify({
                    query: 'software engineer'
                })
            };

            const result = await handler(event);

            expect(result.statusCode).toBe(200);
            expect(mockPineconeSearchRecords).toHaveBeenCalled();
        });
    });

    describe('Pinecone Search Integration', () => {
        const validToken = jwt.sign({ sub: 'test-user-123' }, 'secret');

        test('should perform search with correct parameters', async () => {
            const event = {
                httpMethod: 'POST',
                headers: {
                    Authorization: `Bearer ${validToken}`
                },
                body: JSON.stringify({
                    query: 'software engineer',
                    limit: 5,
                    filters: {
                        company: 'TechCorp',
                        location: 'San Francisco'
                    }
                })
            };

            await handler(event);

            expect(mockPineconeSearchRecords).toHaveBeenCalledWith({
                query: {
                    topK: 15, // 5 * 3 for reranking
                    inputs: { text: 'optimized search query' },
                    filter: {
                        profile_id: { $in: ['PROFILE#john-doe-123', 'PROFILE#jane-smith-456', 'PROFILE#bob-johnson-789'] },
                        company: { $eq: 'TechCorp' },
                        location: { $eq: 'San Francisco' }
                    }
                }
            });
        });

        test('should perform reranking when enabled', async () => {
            const event = {
                httpMethod: 'POST',
                headers: {
                    Authorization: `Bearer ${validToken}`
                },
                body: JSON.stringify({
                    query: 'software engineer',
                    rerank: true
                })
            };

            await handler(event);

            expect(mockPineconeRerank).toHaveBeenCalledWith({
                query: 'optimized search query',
                documents: expect.any(Array),
                model: 'bge-reranker-v2-m3',
                topN: 10,
                rankFields: ['summary']
            });
        });

        test('should skip reranking when disabled', async () => {
            const event = {
                httpMethod: 'POST',
                headers: {
                    Authorization: `Bearer ${validToken}`
                },
                body: JSON.stringify({
                    query: 'software engineer',
                    rerank: false
                })
            };

            await handler(event);

            expect(mockPineconeSearchRecords).toHaveBeenCalledWith({
                query: {
                    topK: 10, // No multiplication for reranking
                    inputs: { text: 'optimized search query' },
                    filter: {
                        profile_id: { $in: ['PROFILE#john-doe-123', 'PROFILE#jane-smith-456', 'PROFILE#bob-johnson-789'] }
                    }
                }
            });
            expect(mockPineconeRerank).not.toHaveBeenCalled();
        });

        test('should handle Pinecone search errors', async () => {
            mockPineconeSearchRecords.mockRejectedValue(new Error('Pinecone search failed'));

            const event = {
                httpMethod: 'POST',
                headers: {
                    Authorization: `Bearer ${validToken}`
                },
                body: JSON.stringify({
                    query: 'software engineer'
                })
            };

            const result = await handler(event);

            expect(result.statusCode).toBe(500);
            expect(JSON.parse(result.body).error).toBe('Internal server error');
        });

        test('should handle reranking errors gracefully', async () => {
            mockPineconeRerank.mockRejectedValue(new Error('Reranking failed'));

            const event = {
                httpMethod: 'POST',
                headers: {
                    Authorization: `Bearer ${validToken}`
                },
                body: JSON.stringify({
                    query: 'software engineer',
                    rerank: true
                })
            };

            const result = await handler(event);

            expect(result.statusCode).toBe(200);
            // Should still return results from original search
            const responseBody = JSON.parse(result.body);
            expect(responseBody.results).toHaveLength(1);
        });
    });

    describe('Response Formatting', () => {
        const validToken = jwt.sign({ sub: 'test-user-123' }, 'secret');

        test('should format successful response correctly', async () => {
            const event = {
                httpMethod: 'POST',
                headers: {
                    Authorization: `Bearer ${validToken}`
                },
                body: JSON.stringify({
                    query: 'software engineer'
                })
            };

            const result = await handler(event);

            expect(result.statusCode).toBe(200);
            expect(result.headers['Content-Type']).toBe('application/json');
            expect(result.headers['Access-Control-Allow-Origin']).toBe('*');

            const responseBody = JSON.parse(result.body);
            expect(responseBody).toHaveProperty('results');
            expect(responseBody).toHaveProperty('total');
            expect(responseBody).toHaveProperty('query_time_ms');

            expect(responseBody.results[0]).toEqual({
                profile_id: 'john-doe-123',
                name: 'John Doe',
                title: 'Senior Software Engineer',
                company: 'TechCorp',
                location: 'San Francisco, CA',
                score: expect.any(Number),
                summary: 'Experienced software engineer...',
                skills: ['JavaScript', 'Python', 'AWS'],
                headline: 'Senior Software Engineer at TechCorp'
            });
        });

        test('should include query timing in response', async () => {
            const event = {
                httpMethod: 'POST',
                headers: {
                    Authorization: `Bearer ${validToken}`
                },
                body: JSON.stringify({
                    query: 'software engineer'
                })
            };

            const result = await handler(event);
            const responseBody = JSON.parse(result.body);

            expect(responseBody.query_time_ms).toBeGreaterThan(0);
            expect(typeof responseBody.query_time_ms).toBe('number');
        });
    });

    describe('Advanced Filtering', () => {
        const validToken = jwt.sign({ sub: 'test-user-123' }, 'secret');

        test('should apply company filter', async () => {
            const event = {
                httpMethod: 'POST',
                headers: {
                    Authorization: `Bearer ${validToken}`
                },
                body: JSON.stringify({
                    query: 'software engineer',
                    filters: {
                        company: 'TechCorp'
                    }
                })
            };

            await handler(event);

            expect(mockPineconeSearchRecords).toHaveBeenCalledWith(
                expect.objectContaining({
                    query: expect.objectContaining({
                        filter: expect.objectContaining({
                            company: { $eq: 'TechCorp' }
                        })
                    })
                })
            );
        });

        test('should apply location filter', async () => {
            const event = {
                httpMethod: 'POST',
                headers: {
                    Authorization: `Bearer ${validToken}`
                },
                body: JSON.stringify({
                    query: 'software engineer',
                    filters: {
                        location: 'San Francisco, CA'
                    }
                })
            };

            await handler(event);

            expect(mockPineconeSearchRecords).toHaveBeenCalledWith(
                expect.objectContaining({
                    query: expect.objectContaining({
                        filter: expect.objectContaining({
                            location: { $eq: 'San Francisco, CA' }
                        })
                    })
                })
            );
        });

        test('should apply skills filter', async () => {
            const event = {
                httpMethod: 'POST',
                headers: {
                    Authorization: `Bearer ${validToken}`
                },
                body: JSON.stringify({
                    query: 'software engineer',
                    filters: {
                        skills: ['JavaScript', 'Python']
                    }
                })
            };

            await handler(event);

            expect(mockPineconeSearchRecords).toHaveBeenCalledWith(
                expect.objectContaining({
                    query: expect.objectContaining({
                        filter: expect.objectContaining({
                            skills: { $in: ['JavaScript', 'Python'] }
                        })
                    })
                })
            );
        });

        test('should apply title filter', async () => {
            const event = {
                httpMethod: 'POST',
                headers: {
                    Authorization: `Bearer ${validToken}`
                },
                body: JSON.stringify({
                    query: 'software engineer',
                    filters: {
                        title: 'Senior Software Engineer'
                    }
                })
            };

            await handler(event);

            expect(mockPineconeSearchRecords).toHaveBeenCalledWith(
                expect.objectContaining({
                    query: expect.objectContaining({
                        filter: expect.objectContaining({
                            title: { $eq: 'Senior Software Engineer' }
                        })
                    })
                })
            );
        });

        test('should apply multiple filters simultaneously', async () => {
            const event = {
                httpMethod: 'POST',
                headers: {
                    Authorization: `Bearer ${validToken}`
                },
                body: JSON.stringify({
                    query: 'software engineer',
                    filters: {
                        company: 'TechCorp',
                        location: 'San Francisco, CA',
                        skills: ['JavaScript'],
                        title: 'Senior Software Engineer'
                    }
                })
            };

            await handler(event);

            expect(mockPineconeSearchRecords).toHaveBeenCalledWith(
                expect.objectContaining({
                    query: expect.objectContaining({
                        filter: {
                            profile_id: { $in: ['PROFILE#john-doe-123', 'PROFILE#jane-smith-456', 'PROFILE#bob-johnson-789'] },
                            company: { $eq: 'TechCorp' },
                            location: { $eq: 'San Francisco, CA' },
                            skills: { $in: ['JavaScript'] },
                            title: { $eq: 'Senior Software Engineer' }
                        }
                    })
                })
            );
        });
    });

    describe('Edge Cases and Error Handling', () => {
        const validToken = jwt.sign({ sub: 'test-user-123' }, 'secret');

        test('should handle empty search results', async () => {
            mockPineconeSearchRecords.mockResolvedValue({
                matches: []
            });

            const event = {
                httpMethod: 'POST',
                headers: {
                    Authorization: `Bearer ${validToken}`
                },
                body: JSON.stringify({
                    query: 'nonexistent query'
                })
            };

            const result = await handler(event);

            expect(result.statusCode).toBe(200);
            const responseBody = JSON.parse(result.body);
            expect(responseBody.results).toEqual([]);
            expect(responseBody.total).toBe(0);
        });

        test('should handle malformed search results', async () => {
            // Override the default mock for this test
            mockPineconeSearchRecords.mockResolvedValueOnce({
                matches: [
                    {
                        id: 'incomplete-profile',
                        score: 0.5,
                        metadata: {
                            profile_id: 'incomplete-profile'
                            // Missing other fields
                        }
                    }
                ]
            });

            // Also override rerank to return the same incomplete data
            mockPineconeRerank.mockResolvedValueOnce({
                matches: [
                    {
                        id: 'incomplete-profile',
                        score: 0.5,
                        metadata: {
                            profile_id: 'incomplete-profile'
                            // Missing other fields
                        }
                    }
                ]
            });

            const event = {
                httpMethod: 'POST',
                headers: {
                    Authorization: `Bearer ${validToken}`
                },
                body: JSON.stringify({
                    query: 'software engineer'
                })
            };

            const result = await handler(event);

            expect(result.statusCode).toBe(200);
            const responseBody = JSON.parse(result.body);
            expect(responseBody.results[0]).toEqual({
                profile_id: 'incomplete-profile',
                name: 'Unknown',
                title: '',
                company: '',
                location: '',
                score: 0.5,
                summary: '',
                skills: [],
                headline: ''
            });
        });

        test('should handle case-insensitive authorization header', async () => {
            const event = {
                httpMethod: 'POST',
                headers: {
                    authorization: `Bearer ${validToken}` // lowercase
                },
                body: JSON.stringify({
                    query: 'software engineer'
                })
            };

            const result = await handler(event);

            expect(result.statusCode).toBe(200);
        });

        test('should limit results to specified limit', async () => {
            // Mock more results than the limit
            const manyResults = Array.from({ length: 20 }, (_, i) => ({
                id: `profile-${i}`,
                score: 0.9 - (i * 0.01),
                metadata: {
                    profile_id: `profile-${i}`,
                    name: `User ${i}`,
                    title: 'Engineer',
                    company: 'Company',
                    location: 'Location',
                    summary: 'Summary',
                    skills: ['Skill'],
                    headline: 'Headline'
                }
            }));

            mockPineconeSearchRecords.mockResolvedValue({
                matches: manyResults
            });

            const event = {
                httpMethod: 'POST',
                headers: {
                    Authorization: `Bearer ${validToken}`
                },
                body: JSON.stringify({
                    query: 'software engineer',
                    limit: 5,
                    rerank: false // Disable reranking to test direct limiting
                })
            };

            const result = await handler(event);

            expect(result.statusCode).toBe(200);
            const responseBody = JSON.parse(result.body);
            expect(responseBody.results).toHaveLength(5);
        });
    });
});

// Helper function to run tests if this file is executed directly
if (require.main === module) {
    console.log('🧪 Running Pinecone Search Lambda Tests');
    console.log('=' * 50);

    // Simple test runner for Node.js without Jest
    const runTests = async () => {
        try {
            // This would require Jest to be installed
            // For now, just indicate that the test file is ready
            console.log('✅ Test file created successfully');
            console.log('📋 Test coverage includes:');
            console.log('   - CORS preflight handling');
            console.log('   - JWT token validation');
            console.log('   - Request validation');
            console.log('   - User connection filtering');
            console.log('   - Query optimization');
            console.log('   - Pinecone search integration');
            console.log('   - Response formatting');
            console.log('   - Advanced filtering');
            console.log('   - Edge cases and error handling');
            console.log('\n🚀 To run tests, install Jest and run:');
            console.log('   npm install --save-dev jest');
            console.log('   npx jest test-pinecone-search-lambda.js');

        } catch (error) {
            console.error('❌ Test setup failed:', error);
        }
    };

    runTests();
}

module.exports = {
    // Export test utilities for potential reuse
    mockDynamoDBQuery,
    mockBedrockInvokeModel,
    mockPineconeSearchRecords,
    mockPineconeRerank
};