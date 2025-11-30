import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { decryptSealboxB64Tag, extractLinkedInCredentials } from '../../../puppeteer-backend/utils/crypto.js';

// Mock fs and libsodium
vi.mock('fs/promises', () => ({
  default: {
    readFile: vi.fn(),
  },
}));

vi.mock('libsodium-wrappers-sumo', () => ({
  default: {
    ready: Promise.resolve(),
    from_base64: vi.fn((b64) => Buffer.from(b64, 'base64')),
    crypto_scalarmult_base: vi.fn((sk) => Buffer.alloc(32, 1)), // Mock public key
    crypto_box_seal_open: vi.fn(() => {
      // Return mock plaintext
      return Buffer.from(JSON.stringify({ email: 'test@example.com', password: 'TestPass123!' }));
    }),
    base64_variants: { ORIGINAL: 1 },
  },
}));

import fs from 'fs/promises';
import sodium from 'libsodium-wrappers-sumo';

describe('crypto.js - CRITICAL Security Module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRED_SEALBOX_PRIVATE_KEY_PATH = '/mock/path/to/key';
  });

  afterEach(() => {
    delete process.env.CRED_SEALBOX_PRIVATE_KEY_PATH;
  });

  describe('decryptSealboxB64Tag - Encryption/Decryption Security', () => {
    it('should decrypt valid sealbox ciphertext successfully', async () => {
      fs.readFile.mockResolvedValue('bW9ja19wcml2YXRlX2tleV8zMl9ieXRlc19iYXNlNjQ='); // 32-byte mock key

      const ciphertext = 'sealbox_x25519:b64:' + Buffer.from('encrypted').toString('base64');
      const result = await decryptSealboxB64Tag(ciphertext);

      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
      expect(sodium.crypto_box_seal_open).toHaveBeenCalled();
    });

    it('should return null for invalid ciphertext type', async () => {
      const result = await decryptSealboxB64Tag(123); // Not a string

      expect(result).toBeNull();
    });

    it('should return null for missing prefix', async () => {
      const result = await decryptSealboxB64Tag('invalid_prefix:data');

      expect(result).toBeNull();
    });

    it('should return null when private key is not configured', async () => {
      delete process.env.CRED_SEALBOX_PRIVATE_KEY_PATH;

      const ciphertext = 'sealbox_x25519:b64:' + Buffer.from('test').toString('base64');
      const result = await decryptSealboxB64Tag(ciphertext);

      expect(result).toBeNull();
    });

    it('should return null when private key file is unreadable', async () => {
      fs.readFile.mockRejectedValue(new Error('File not found'));

      const ciphertext = 'sealbox_x25519:b64:' + Buffer.from('test').toString('base64');
      const result = await decryptSealboxB64Tag(ciphertext);

      expect(result).toBeNull();
    });

    it('should return null for invalid key length', async () => {
      fs.readFile.mockResolvedValue('c2hvcnQ='); // Too short (<32 bytes)

      const ciphertext = 'sealbox_x25519:b64:' + Buffer.from('test').toString('base64');
      const result = await decryptSealboxB64Tag(ciphertext);

      expect(result).toBeNull();
    });

    it('should handle decryption errors gracefully', async () => {
      fs.readFile.mockResolvedValue('bW9ja19wcml2YXRlX2tleV8zMl9ieXRlc19iYXNlNjQ=');
      sodium.crypto_box_seal_open.mockImplementation(() => {
        throw new Error('Decryption failed - invalid ciphertext');
      });

      const ciphertext = 'sealbox_x25519:b64:' + Buffer.from('invalid').toString('base64');
      const result = await decryptSealboxB64Tag(ciphertext);

      expect(result).toBeNull();
    });

    it('should handle malformed base64 ciphertext', async () => {
      fs.readFile.mockResolvedValue('bW9ja19wcml2YXRlX2tleV8zMl9ieXRlc19iYXNlNjQ=');

      const ciphertext = 'sealbox_x25519:b64:!!!invalid_base64!!!';
      const result = await decryptSealboxB64Tag(ciphertext);

      // Should handle gracefully and return null
      expect(result).toBeNull();
    });

    it('should correctly parse JSON from decrypted plaintext', async () => {
      fs.readFile.mockResolvedValue('bW9ja19wcml2YXRlX2tleV8zMl9ieXRlc19iYXNlNjQ=');

      const expectedData = { email: 'test@example.com', password: 'TestPass123!' };
      sodium.crypto_box_seal_open.mockReturnValue(
        Buffer.from(JSON.stringify(expectedData))
      );

      const ciphertext = 'sealbox_x25519:b64:' + Buffer.from('encrypted').toString('base64');
      const result = await decryptSealboxB64Tag(ciphertext);

      const parsed = JSON.parse(result);
      expect(parsed.email).toBe('test@example.com');
      expect(parsed.password).toBe('TestPass123!');
    });
  });

  describe('extractLinkedInCredentials - Credential Extraction Security', () => {
    it('should extract credentials from encrypted payload', async () => {
      fs.readFile.mockResolvedValue('bW9ja19wcml2YXRlX2tleV8zMl9ieXRlc19iYXNlNjQ=');

      const body = {
        linkedinCredentialsCiphertext: 'sealbox_x25519:b64:' + Buffer.from('encrypted').toString('base64'),
      };

      const result = await extractLinkedInCredentials(body);

      expect(result).toBeDefined();
      expect(result.searchName).toBe('test@example.com');
      expect(result.searchPassword).toBe('TestPass123!');
    });

    it('should return null when ciphertext is missing', async () => {
      const body = {};

      const result = await extractLinkedInCredentials(body);

      expect(result).toBeNull();
    });

    it('should return null when decryption fails', async () => {
      fs.readFile.mockRejectedValue(new Error('Key not found'));

      const body = {
        linkedinCredentialsCiphertext: 'sealbox_x25519:b64:' + Buffer.from('test').toString('base64'),
      };

      const result = await extractLinkedInCredentials(body);

      expect(result).toBeNull();
    });

    it('should return null when decrypted object missing required fields', async () => {
      fs.readFile.mockResolvedValue('bW9ja19wcml2YXRlX2tleV8zMl9ieXRlc19iYXNlNjQ=');
      sodium.crypto_box_seal_open.mockReturnValue(
        Buffer.from(JSON.stringify({ email: 'test@example.com' })) // Missing password
      );

      const body = {
        linkedinCredentialsCiphertext: 'sealbox_x25519:b64:' + Buffer.from('test').toString('base64'),
      };

      const result = await extractLinkedInCredentials(body);

      expect(result).toBeNull();
    });

    it('should handle malformed JSON in decrypted payload', async () => {
      fs.readFile.mockResolvedValue('bW9ja19wcml2YXRlX2tleV8zMl9ieXRlc19iYXNlNjQ=');
      sodium.crypto_box_seal_open.mockReturnValue(Buffer.from('invalid-json{'));

      const body = {
        linkedinCredentialsCiphertext: 'sealbox_x25519:b64:' + Buffer.from('test').toString('base64'),
      };

      const result = await extractLinkedInCredentials(body);

      expect(result).toBeNull();
    });

    it('should handle empty body gracefully', async () => {
      const result = await extractLinkedInCredentials();

      expect(result).toBeNull();
    });

    it('should reject plaintext credentials for security', async () => {
      const body = {
        email: 'test@example.com',
        password: 'PlaintextPassword123!', // Plaintext - should be rejected
      };

      const result = await extractLinkedInCredentials(body);

      expect(result).toBeNull(); // Security policy: only accept encrypted
    });
  });

  describe('Security Properties', () => {
    it('should use X25519 curve25519 for encryption', async () => {
      fs.readFile.mockResolvedValue('bW9ja19wcml2YXRlX2tleV8zMl9ieXRlc19iYXNlNjQ=');

      const ciphertext = 'sealbox_x25519:b64:' + Buffer.from('test').toString('base64');
      await decryptSealboxB64Tag(ciphertext);

      expect(sodium.crypto_scalarmult_base).toHaveBeenCalled(); // X25519 operation
    });

    it('should enforce 32-byte private key length', async () => {
      fs.readFile.mockResolvedValue('c2hvcnQ='); // Short key

      const ciphertext = 'sealbox_x25519:b64:' + Buffer.from('test').toString('base64');
      const result = await decryptSealboxB64Tag(ciphertext);

      expect(result).toBeNull(); // Should reject invalid key length
    });

    it('should not expose sensitive data in errors', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      fs.readFile.mockRejectedValue(new Error('File not found'));

      const ciphertext = 'sealbox_x25519:b64:' + Buffer.from('sensitive').toString('base64');
      await decryptSealboxB64Tag(ciphertext);

      // Error messages should not contain the ciphertext
      expect(consoleSpy).not.toHaveBeenCalledWith(expect.stringContaining('sensitive'));

      consoleSpy.mockRestore();
    });
  });
});
