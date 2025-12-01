import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('fs/promises', () => ({
  default: {
    readFile: vi.fn(),
  },
  readFile: vi.fn(),
}));

vi.mock('libsodium-wrappers-sumo', () => ({
  default: {
    ready: Promise.resolve(),
    from_base64: vi.fn(),
    crypto_scalarmult_base: vi.fn(),
    crypto_box_seal_open: vi.fn(),
    base64_variants: { ORIGINAL: 0 },
  },
}));

vi.mock('../../../src/shared/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('Crypto', () => {
  let decryptSealboxB64Tag;
  let extractLinkedInCredentials;
  let mockFs;
  let mockSodium;

  beforeEach(async () => {
    vi.resetModules();
    mockFs = await import('fs/promises');
    mockSodium = await import('libsodium-wrappers-sumo');
    const module = await import('../../../src/shared/utils/crypto.js');
    decryptSealboxB64Tag = module.decryptSealboxB64Tag;
    extractLinkedInCredentials = module.extractLinkedInCredentials;
  });

  afterEach(() => {
    vi.clearAllMocks();
    delete process.env.CRED_SEALBOX_PRIVATE_KEY_PATH;
  });

  describe('decryptSealboxB64Tag', () => {
    it('should return null for non-string input', async () => {
      const result = await decryptSealboxB64Tag(123);
      expect(result).toBeNull();
    });

    it('should return null for string without required prefix', async () => {
      const result = await decryptSealboxB64Tag('invalid-prefix:data');
      expect(result).toBeNull();
    });

    it('should return null when private key is not configured', async () => {
      const result = await decryptSealboxB64Tag('sealbox_x25519:b64:somedata');
      expect(result).toBeNull();
    });

    it('should return null when private key file read fails', async () => {
      process.env.CRED_SEALBOX_PRIVATE_KEY_PATH = '/path/to/key';
      mockFs.default.readFile.mockRejectedValue(new Error('File not found'));

      const result = await decryptSealboxB64Tag('sealbox_x25519:b64:somedata');
      expect(result).toBeNull();
    });

    it('should return null when private key is wrong size', async () => {
      process.env.CRED_SEALBOX_PRIVATE_KEY_PATH = '/path/to/key';
      mockFs.default.readFile.mockResolvedValue(Buffer.from('short').toString('base64'));

      const result = await decryptSealboxB64Tag('sealbox_x25519:b64:somedata');
      expect(result).toBeNull();
    });

    it('should attempt decryption with valid key and ciphertext', async () => {
      process.env.CRED_SEALBOX_PRIVATE_KEY_PATH = '/path/to/key';
      const validKey = Buffer.alloc(32, 1).toString('base64');
      mockFs.default.readFile.mockResolvedValue(validKey);
      mockSodium.default.from_base64.mockReturnValue(new Uint8Array(32));
      mockSodium.default.crypto_scalarmult_base.mockReturnValue(new Uint8Array(32));
      mockSodium.default.crypto_box_seal_open.mockReturnValue(new Uint8Array(Buffer.from('decrypted')));

      const result = await decryptSealboxB64Tag('sealbox_x25519:b64:c29tZWRhdGE=');
      expect(result).toBe('decrypted');
    });

    it('should return null when decryption fails', async () => {
      process.env.CRED_SEALBOX_PRIVATE_KEY_PATH = '/path/to/key';
      const validKey = Buffer.alloc(32, 1).toString('base64');
      mockFs.default.readFile.mockResolvedValue(validKey);
      mockSodium.default.from_base64.mockReturnValue(new Uint8Array(32));
      mockSodium.default.crypto_scalarmult_base.mockReturnValue(new Uint8Array(32));
      mockSodium.default.crypto_box_seal_open.mockImplementation(() => {
        throw new Error('Decryption failed');
      });

      const result = await decryptSealboxB64Tag('sealbox_x25519:b64:c29tZWRhdGE=');
      expect(result).toBeNull();
    });
  });

  describe('extractLinkedInCredentials', () => {
    it('should return null when no encrypted credentials provided', async () => {
      const result = await extractLinkedInCredentials({});
      expect(result).toBeNull();
    });

    it('should return null when decryption fails', async () => {
      const result = await extractLinkedInCredentials({
        linkedinCredentialsCiphertext: 'invalid-ciphertext',
      });
      expect(result).toBeNull();
    });

    it('should return credentials when decryption succeeds', async () => {
      process.env.CRED_SEALBOX_PRIVATE_KEY_PATH = '/path/to/key';
      const validKey = Buffer.alloc(32, 1).toString('base64');
      mockFs.default.readFile.mockResolvedValue(validKey);
      mockSodium.default.from_base64.mockReturnValue(new Uint8Array(32));
      mockSodium.default.crypto_scalarmult_base.mockReturnValue(new Uint8Array(32));

      const credentials = JSON.stringify({ email: 'test@example.com', password: 'secret' });
      mockSodium.default.crypto_box_seal_open.mockReturnValue(new Uint8Array(Buffer.from(credentials)));

      const result = await extractLinkedInCredentials({
        linkedinCredentialsCiphertext: 'sealbox_x25519:b64:c29tZWRhdGE=',
      });

      expect(result).toEqual({
        searchName: 'test@example.com',
        searchPassword: 'secret',
      });
    });

    it('should return null when decrypted object is missing required fields', async () => {
      process.env.CRED_SEALBOX_PRIVATE_KEY_PATH = '/path/to/key';
      const validKey = Buffer.alloc(32, 1).toString('base64');
      mockFs.default.readFile.mockResolvedValue(validKey);
      mockSodium.default.from_base64.mockReturnValue(new Uint8Array(32));
      mockSodium.default.crypto_scalarmult_base.mockReturnValue(new Uint8Array(32));

      const credentials = JSON.stringify({ email: 'test@example.com' }); // missing password
      mockSodium.default.crypto_box_seal_open.mockReturnValue(new Uint8Array(Buffer.from(credentials)));

      const result = await extractLinkedInCredentials({
        linkedinCredentialsCiphertext: 'sealbox_x25519:b64:c29tZWRhdGE=',
      });

      expect(result).toBeNull();
    });

    it('should handle parsing errors gracefully', async () => {
      process.env.CRED_SEALBOX_PRIVATE_KEY_PATH = '/path/to/key';
      const validKey = Buffer.alloc(32, 1).toString('base64');
      mockFs.default.readFile.mockResolvedValue(validKey);
      mockSodium.default.from_base64.mockReturnValue(new Uint8Array(32));
      mockSodium.default.crypto_scalarmult_base.mockReturnValue(new Uint8Array(32));
      mockSodium.default.crypto_box_seal_open.mockReturnValue(new Uint8Array(Buffer.from('invalid json')));

      const result = await extractLinkedInCredentials({
        linkedinCredentialsCiphertext: 'sealbox_x25519:b64:c29tZWRhdGE=',
      });

      expect(result).toBeNull();
    });
  });
});
