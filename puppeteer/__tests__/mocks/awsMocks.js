import { vi } from 'vitest';

export const createMockDynamoDBClient = (overrides = {}) => ({
  send: vi.fn().mockResolvedValue({}),
  config: {
    region: 'us-east-1',
  },
  destroy: vi.fn(),
  ...overrides,
});

export const createMockDynamoDBDocClient = (overrides = {}) => ({
  send: vi.fn().mockResolvedValue({}),
  config: {
    region: 'us-east-1',
  },
  destroy: vi.fn(),
  ...overrides,
});

export const createMockPutCommandResponse = (overrides = {}) => ({
  $metadata: {
    httpStatusCode: 200,
    requestId: 'mock-request-id',
    attempts: 1,
    totalRetryDelay: 0,
  },
  ...overrides,
});

export const createMockGetCommandResponse = (item = null, overrides = {}) => ({
  $metadata: {
    httpStatusCode: 200,
    requestId: 'mock-request-id',
  },
  Item: item,
  ...overrides,
});

export const createMockQueryCommandResponse = (items = [], overrides = {}) => ({
  $metadata: {
    httpStatusCode: 200,
    requestId: 'mock-request-id',
  },
  Items: items,
  Count: items.length,
  ScannedCount: items.length,
  ...overrides,
});

export const createMockUpdateCommandResponse = (overrides = {}) => ({
  $metadata: {
    httpStatusCode: 200,
    requestId: 'mock-request-id',
  },
  Attributes: {},
  ...overrides,
});

export const createMockDeleteCommandResponse = (overrides = {}) => ({
  $metadata: {
    httpStatusCode: 200,
    requestId: 'mock-request-id',
  },
  ...overrides,
});

export const createMockS3Client = (overrides = {}) => ({
  send: vi.fn().mockResolvedValue({}),
  config: {
    region: 'us-east-1',
  },
  destroy: vi.fn(),
  ...overrides,
});

export const createMockPutObjectResponse = (overrides = {}) => ({
  $metadata: {
    httpStatusCode: 200,
    requestId: 'mock-request-id',
  },
  ETag: '"mock-etag"',
  ...overrides,
});

export const createMockGetObjectResponse = (body = '', overrides = {}) => ({
  $metadata: {
    httpStatusCode: 200,
    requestId: 'mock-request-id',
  },
  Body: {
    transformToString: vi.fn().mockResolvedValue(body),
    transformToByteArray: vi.fn().mockResolvedValue(new Uint8Array()),
  },
  ContentType: 'text/plain',
  ContentLength: body.length,
  ...overrides,
});

export const createMockPresignedUrl = (bucket = 'test-bucket', key = 'test-key') =>
  `https://${bucket}.s3.amazonaws.com/${key}?X-Amz-Signature=mock-signature`;
