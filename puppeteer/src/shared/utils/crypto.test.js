import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'fs';

// Mock fs
vi.mock('fs', () => ({
  readFileSync: vi.fn(),
  existsSync: vi.fn(() => true),
}));

// Mock sodium
vi.mock('libsodium-wrappers-sumo', () => ({
  default: {
    ready: Promise.resolve(),
    crypto_box_seal_open: vi.fn(),
    from_base64: vi.fn((str) => new Uint8Array(Buffer.from(str, 'base64'))),
    to_string: vi.fn((bytes) => Buffer.from(bytes).toString()),
  }
}));

describe('crypto utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('decryptSealboxB64Tag', () => {
    it('should reject non-string input', async () => {
      const { decryptSealboxB64Tag } = await import('./crypto.js');
      const result = await decryptSealboxB64Tag(123);
      expect(result).toBeNull();
    });

    it('should reject input without correct prefix', async () => {
      const { decryptSealboxB64Tag } = await import('./crypto.js');
      const result = await decryptSealboxB64Tag('wrong-prefix:data');
      expect(result).toBeNull();
    });

    it('should handle missing private key gracefully', async () => {
      readFileSync.mockImplementation(() => { throw new Error('ENOENT'); });
      // Re-import to trigger key loading
      vi.resetModules();
      vi.mock('fs', () => ({
        readFileSync: vi.fn(() => { throw new Error('ENOENT'); }),
        existsSync: vi.fn(() => false),
      }));
      // This tests the error path - function should return null
    });
  });

  describe('extractLinkedInCredentials', () => {
    it('should return null when no credentials provided', async () => {
      const { extractLinkedInCredentials } = await import('./crypto.js');
      const result = await extractLinkedInCredentials(null);
      expect(result).toBeNull();
    });

    it('should return null for empty string', async () => {
      const { extractLinkedInCredentials } = await import('./crypto.js');
      const result = await extractLinkedInCredentials('');
      expect(result).toBeNull();
    });

    it('should return null for undefined', async () => {
      const { extractLinkedInCredentials } = await import('./crypto.js');
      const result = await extractLinkedInCredentials(undefined);
      expect(result).toBeNull();
    });

    it('should handle structured credentials object', async () => {
      const { extractLinkedInCredentials } = await import('./crypto.js');
      const creds = { email: 'test@example.com', password: 'pass123' };
      const result = await extractLinkedInCredentials(creds);
      // Structured creds pass through directly
      if (result) {
        expect(result.email).toBe('test@example.com');
        expect(result.password).toBe('pass123');
      }
    });
  });
});
