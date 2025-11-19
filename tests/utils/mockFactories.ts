/**
 * Factory functions for creating test data
 * These help create consistent mock data across tests
 */

/**
 * Create a mock LinkedIn profile
 */
export const createMockProfile = (overrides: Partial<any> = {}) => ({
  id: 'test-profile-id',
  name: 'Test User',
  headline: 'Software Engineer at Test Company',
  location: 'Test City, TC',
  connections: '500+',
  about: 'Test about section',
  experience: [],
  education: [],
  skills: ['JavaScript', 'TypeScript'],
  ...overrides,
});

/**
 * Create a mock connection
 */
export const createMockConnection = (overrides: Partial<any> = {}) => ({
  id: 'test-connection-id',
  userId: 'test-user-id',
  profileId: 'test-profile-id',
  name: 'Test Connection',
  status: 'CONNECTED',
  connectedAt: new Date().toISOString(),
  ...overrides,
});

/**
 * Create a mock search result
 */
export const createMockSearchResult = (overrides: Partial<any> = {}) => ({
  id: 'test-search-result-id',
  name: 'Test Search Result',
  headline: 'Test Headline',
  location: 'Test Location',
  relevance: 0.95,
  ...overrides,
});

/**
 * Create a mock message
 */
export const createMockMessage = (overrides: Partial<any> = {}) => ({
  id: 'test-message-id',
  recipientId: 'test-recipient-id',
  content: 'Test message content',
  status: 'SENT',
  sentAt: new Date().toISOString(),
  ...overrides,
});

/**
 * Create a mock workflow progress
 */
export const createMockWorkflowProgress = (overrides: Partial<any> = {}) => ({
  workflowId: 'test-workflow-id',
  currentStep: 1,
  totalSteps: 5,
  status: 'IN_PROGRESS',
  progress: 20,
  startedAt: new Date().toISOString(),
  ...overrides,
});

/**
 * Create a mock user
 */
export const createMockUser = (overrides: Partial<any> = {}) => ({
  id: 'test-user-id',
  email: 'test@example.com',
  name: 'Test User',
  createdAt: new Date().toISOString(),
  ...overrides,
});

/**
 * Create a mock Cognito user
 */
export const createMockCognitoUser = (overrides: Partial<any> = {}) => ({
  username: 'test-user',
  attributes: {
    email: 'test@example.com',
    email_verified: true,
    sub: 'test-cognito-sub',
  },
  ...overrides,
});

/**
 * Create a mock API error response
 */
export const createMockApiError = (
  message: string = 'Test error',
  status: number = 500
) => ({
  error: {
    message,
    status,
    timestamp: new Date().toISOString(),
  },
});

/**
 * Create mock DynamoDB item
 */
export const createMockDynamoDBItem = (overrides: Partial<any> = {}) => ({
  PK: 'USER#test-user-id',
  SK: 'PROFILE#test-profile-id',
  type: 'profile',
  data: {},
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
});

/**
 * Create a mock Lambda event (API Gateway)
 */
export const createMockLambdaEvent = (overrides: Partial<any> = {}) => ({
  httpMethod: 'GET',
  path: '/test',
  headers: {
    'Content-Type': 'application/json',
  },
  queryStringParameters: null,
  pathParameters: null,
  body: null,
  isBase64Encoded: false,
  requestContext: {
    requestId: 'test-request-id',
    identity: {
      sourceIp: '127.0.0.1',
    },
  },
  ...overrides,
});

/**
 * Create a mock Lambda context
 */
export const createMockLambdaContext = (overrides: Partial<any> = {}) => ({
  functionName: 'test-function',
  functionVersion: '1',
  invokedFunctionArn: 'arn:aws:lambda:us-east-1:123456789012:function:test',
  memoryLimitInMB: '128',
  awsRequestId: 'test-request-id',
  logGroupName: '/aws/lambda/test',
  logStreamName: '2024/01/01/[$LATEST]test',
  getRemainingTimeInMillis: () => 3000,
  done: () => {},
  fail: () => {},
  succeed: () => {},
  ...overrides,
});
