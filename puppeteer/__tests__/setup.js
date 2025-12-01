import { beforeAll, afterAll, vi } from 'vitest';

beforeAll(() => {
  process.env.NODE_ENV = 'test';
  process.env.AWS_REGION = 'us-east-1';
});

afterAll(() => {
  vi.restoreAllMocks();
});
