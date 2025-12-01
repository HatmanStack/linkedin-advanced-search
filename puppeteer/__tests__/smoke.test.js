import { describe, it, expect, vi } from 'vitest';
import { createMockBrowser, createMockPage } from './mocks/index.js';
import { createMockRequest, createMockResponse, createMockNext } from './helpers/index.js';

describe('Smoke Tests', () => {
  describe('Test Infrastructure', () => {
    it('should run basic assertions', () => {
      expect(1 + 1).toBe(2);
      expect('test').toContain('es');
      expect([1, 2, 3]).toHaveLength(3);
    });

    it('should support async tests', async () => {
      const result = await Promise.resolve('async works');
      expect(result).toBe('async works');
    });

    it('should support mocking', () => {
      const mockFn = vi.fn().mockReturnValue(42);
      expect(mockFn()).toBe(42);
      expect(mockFn).toHaveBeenCalledTimes(1);
    });
  });

  describe('Mock Factories', () => {
    it('should create mock browser with expected methods', () => {
      const browser = createMockBrowser();
      expect(browser.newPage).toBeDefined();
      expect(browser.close).toBeDefined();
      expect(browser.isConnected).toBeDefined();
    });

    it('should create mock page with expected methods', () => {
      const page = createMockPage();
      expect(page.goto).toBeDefined();
      expect(page.click).toBeDefined();
      expect(page.type).toBeDefined();
      expect(page.evaluate).toBeDefined();
      expect(page.screenshot).toBeDefined();
    });

    it('should allow overrides in mock factories', () => {
      const customUrl = 'https://custom.example.com';
      const page = createMockPage({
        url: vi.fn().mockReturnValue(customUrl),
      });
      expect(page.url()).toBe(customUrl);
    });
  });

  describe('Express Mock Utilities', () => {
    it('should create mock request with default values', () => {
      const req = createMockRequest();
      expect(req.body).toEqual({});
      expect(req.params).toEqual({});
      expect(req.query).toEqual({});
    });

    it('should create mock request with custom values', () => {
      const req = createMockRequest({
        body: { name: 'test' },
        params: { id: '123' },
      });
      expect(req.body.name).toBe('test');
      expect(req.params.id).toBe('123');
    });

    it('should create mock response with chainable methods', () => {
      const res = createMockResponse();
      res.status(200).json({ success: true });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ success: true });
      expect(res.statusCode).toBe(200);
      expect(res._json).toEqual({ success: true });
    });

    it('should create mock next function', () => {
      const next = createMockNext();
      next();
      expect(next).toHaveBeenCalledTimes(1);
    });
  });
});
